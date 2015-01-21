'use strict'

wash.mounter = {};
wash.mounter.mounts = [];

wash.mounter.mount = function(entry, entryId, localPath, path) {
  this.entry = entry;
  this.entryId = entryId;
  this.localPath = localPath;
  this.path = path;
}

wash.mounter.addMount = function(entry, entryId, localPath, path) {
  var m = new wash.mounter.mount(entry, entryId, localPath, path);
  wash.mounter.mounts.push(m);

  for (var appName in wash.shared_modules.apps) {
    if (wash.shared_modules.handlesMounts[appName] &&
        wash.shared_modules.apps[appName].isRunning()) {
      wash.shared_modules.apps[appName].handleAddMount(m);
    }
  }

  wash.mounter.saveWashMounts();
  syncMounts();
}

wash.mounter.removeMount = function(path, callback, callbackError) {
  var found = false;
  for (var i = 0; i < wash.mounter.mounts.length; i++) {
    var mount = wash.mounter.mounts[i];
    if (mount.path === path) {
      found = true;
      wash.mounter.mounts.splice(i, 1);
      for (var appName in wash.shared_modules.apps) {
        if (wash.shared_modules.handlesMounts[appName] &&
            wash.shared_modules.apps[appName].isRunning()) {
          wash.shared_modules.apps[appName].handleRemoveMount(mount);
        }
      }
      break;
    }
  }

  if (found)
    callback();
  else
    callbackError();

  wash.mounter.saveWashMounts();
  syncMounts();
}

wash.mounter.getEntryWithId = function(entryId, callback, callbackError) {
  chrome.fileSystem.isRestorable(entryId, function(isRestorable) {
    if (isRestorable)
      chrome.fileSystem.restoreEntry(entryId, callback);
    else
      callbackError();
  });
}

// Assuming top level paths are unique
wash.mounter.getRootDirectory = function(path, callback, callbackError) {
  // Get the top level path
  var path = "/" + path.split('/')[1];
  var found = false;
  wash.mounter.mounts.forEach(function(mount) {
    if (mount.path === path) {
      found = true;
      wash.mounter.getEntryWithId(mount.entryId, callback, callbackError);
    }
  });

  if (!found)
    callbackError();
}

wash.mounter.saveWashMounts = function() {
  chrome.storage.local.set({'wash_mounts': wash.mounter.mounts}, function() {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
      return;
    }
  });
}

wash.mounter.restoreWashMountsFromStorage = function(callback) {
  chrome.storage.local.get('wash_mounts', function(item) {
    if (item && Array.isArray(item.wash_mounts)) {
      wash.mounter.mounts = item.wash_mounts;
      callback();
    }
  });
}

/*********************************************

FUNCTIONS FOR MOUNTER UI

********************************************/
var isVisible = false;
var mounterBackground = null;
var mounter = null;
var mounterHeader = null;
var mounterBtn = null;
var mounterCloseBtn = null;
var win = null;
var terminal = null;

function intToPixels(int) {
  return int + 'px';
}

function walkDom(callback) {
  var body = document.body;
  var loop = function(element) {
    do {
      var recurse = true;
      if(element.nodeType == 1)
        recurse = callback(element);
      if (recurse && element.hasChildNodes() && !element.hidden)
        loop(element.firstChild);
      element = element.nextSibling;
    }
    while (element);
  };
  loop(body);
}

function grabFocus() {
  walkDom(function(element) {
    if (element == mounterBackground)
      return false;

    if (element.hasAttribute('tabIndex')) {
      element.oldTabIndex = element.getAttribute('tabIndex');
    }
    element.setAttribute('tabIndex', '-1');
    return true;
  })
}

function releaseFocus() {
  walkDom(function(element) {
    if (element == mounterBackground)
      return false;

    if (element.oldTabIndex) {
      element.setAttribute('tabIndex', element.oldTabIndex);
      delete element.oldTabIndex;
    } else {
      element.removeAttribute('tabIndex');
    }
    return true;
  });
  terminal.focus();
}

function sizeBackground() {
  // TODO: call this on window size.
  mounterBackground.style.height = intToPixels(win.innerHeight);
  var bgTop = 0;
  if (!isVisible)
    bgTop = win.innerHeight
  mounterBackground.style.top = intToPixels(bgTop);
}

function changeVisibility(visible) {
  // Save / restore focus. Make unfocusable if not visible.
  isVisible = visible;
  sizeBackground()
  if (isVisible)
    grabFocus();
  else
    releaseFocus();
}

function mountBtnClicked(event) {
  if (!isVisible)
    changeVisibility(true);
  event.stopPropagation();
}

function mountCloseBtnClicked(event) {
  if (isVisible)
    changeVisibility(false);
}

function newMountClicked(event) {
  win.chrome.fileSystem.chooseEntry(
    {'type': 'openDirectory'},
    function(dirEntry) {
      var entryId = chrome.fileSystem.retainEntry(dirEntry);
      chrome.fileSystem.getDisplayPath(dirEntry, function(localPath) {
        var ary = localPath.split("/");
        var path = "/" + ary[ary.length - 1];
        wash.mounter.addMount(dirEntry, entryId, localPath, path);
      });
    });
}

function removeMountClicked(event) {
  var mount = event.target.mountControl.mounts;
  var index = wash.mounter.mounts.indexOf(mount);
  wash.mounter.mounts.splice(index, 1);

  for (var appName in wash.shared_modules.apps) {
    if (wash.shared_modules.handlesMounts[appName] &&
        wash.shared_modules.apps[appName].isRunning()) {
      wash.shared_modules.apps[appName].handleRemoveMount(mount);
    }
  }

  wash.mounter.saveWashMounts();
  syncMounts();
}

function addNewMountControl() {
  var newMountControl = win.document.createElement('div');
  newMountControl.classList.add('mount_control');

  var addButton = win.document.createElement('button');
  addButton.innerHTML = 'Add Mount';
  addButton.onclick = newMountClicked;
  addButton.classList.add('addOrRemoveButton');
  newMountControl.appendChild(addButton);

  mounter.appendChild(newMountControl);
}

function addMountControlItem(item, mountControl) {
  mountControl.appendChild(item);
  item.mountControl = mountControl;
}

function mountPointChanged(event) {
  var mountControl = event.target.mountControl;
  var mount = mountControl.mount;
  var id = mount.entryId;
  var newPath = mountControl.pathEdit.value;
  wash.mounter.removeMount(mount.path, function() {
    wash.mounter.addMount(
      mount.entry, mount.entryId, mount.localPath, newPath);
  }, function() {
    console.log("Couldn't find mount to change!");
  });
}

function cancelMountPointChange(event) {
  var mountControl = event.target.mountControl;

  // Remove the buttons
  mountControl.removeChild(mountControl.cancelButton);
  mountControl.removeChild(mountControl.updateButton);
  mountControl.updateButton = null;
  mountControl.cancelButton = null;

  mountControl.pathEdit.value = mountControl.mount.path;
}

function addUpdateOrCancelButtons(event) {
  var mountControl = event.target.mountControl;

  if (mountControl.updateButton && mountControl.cancelButton)
    return;

  var updateButton = document.createElement('button');
  updateButton.innerHTML = 'Update Mount';
  updateButton.classList.add('addOrRemoveButton');
  addMountControlItem(updateButton, mountControl);
  mountControl.updateButton = updateButton;
  updateButton.onclick = mountPointChanged;

  var cancelButton = document.createElement('button');
  cancelButton.innerHTML = 'Cancel';
  cancelButton.classList.add('addOrRemoveButton');
  addMountControlItem(cancelButton, mountControl);
  mountControl.cancelButton = cancelButton;
  cancelButton.onclick = cancelMountPointChange;
}

function addMountControl(mount, afterElement) {
  var mountControl = document.createElement('div');
  mountControl.classList.add('mount_control');

  var removeButton = document.createElement('button');
  removeButton.innerHTML = 'Remove Mount';
  removeButton.classList.add('addOrRemoveButton');
  addMountControlItem(removeButton, mountControl);
  mountControl.removeButton = removeButton;
  removeButton.onclick = removeMountClicked;

  var localPathLabel = document.createElement('span');
  localPathLabel.innerHTML = 'Local path:';
  localPathLabel.classList.add('title');
  mountControl.appendChild(localPathLabel);

  var localPathEdit = document.createElement('span');
  localPathEdit.innerHTML = mount.localPath;
  mountControl.appendChild(localPathEdit);

  var pathEditLabel = document.createElement('span');
  pathEditLabel.innerHTML = 'Mount point:';
  pathEditLabel.classList.add('title');
  mountControl.appendChild(pathEditLabel);

  var pathEdit = document.createElement('input');
  pathEdit.value = mount.path;
  addMountControlItem(pathEdit, mountControl);
  mountControl.pathEdit = pathEdit;
  pathEdit.oninput = addUpdateOrCancelButtons;

  mountControl.mount = mount;

  if (afterElement) {
    mounter.insertBefore(mountControl, afterElement.nextSibling);
  } else {
    mounter.insertBefore(mountControl, mounterHeader.nextSibling);
  }

  return mountControl;
}

function syncMounts() {
  var control = mounter.firstChild;
  while (control && control.mount == null)
    control = control.nextSibling;
  while (control && control.mount != null) {
    var nextControl = control.nextSibling;
    mounter.removeChild(control);
    control = nextControl;
  }

  var lastMountControl = null;
  wash.mounter.mounts.forEach(function(mount) {
    lastMountControl = addMountControl(mount, lastMountControl);
  });
}

wash.mounter.preInitMounter = function() {
  win = window.tw_.wmWindow_.appWindow_.contentWindow;
  terminal = win.document.getElementById('wash_window_outer');
  mounter = win.document.getElementById('mounter');
  mounterBackground = win.document.getElementById('mounter_background');
  mounterHeader = win.document.getElementById('mounter_header');
  mounterBtn = win.document.getElementById('wash_window_mount');
  mounterCloseBtn = win.document.getElementById('mounter_close');

  mounterBtn.onclick = mountBtnClicked;
  mounterCloseBtn.onclick = mountCloseBtnClicked;

  changeVisibility(false);
  addNewMountControl();

  var lastMountControl = null;
  wash.mounter.mounts.forEach(function(mount) {
    lastMountControl = addMountControl(mount, lastMountControl);
  });
}
