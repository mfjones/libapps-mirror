"use strict";

var mounterBackground = null;
var mounterThumb = null;
var mounterHeader = null;
var mounter = null;
var isVisible = false;
var newMountControl = null;

var mounterClient = null;

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
  })
  mounterClient.terminal.focus();
}

function sizeBackground() {
  // TODO: call this on window size.
  mounterBackground.style.height = intToPixels(window.innerHeight);
  var bgTop = 0;
  if (!isVisible)
    bgTop = 10 - window.innerHeight
  mounterBackground.style.top = intToPixels(bgTop);
}

function changeVisibility(visible) {
  // Save / restore focus. Make unfocusable if not visible.
  isVisible = visible;

  sizeBackground()
  if (!mounterClient)
    return;

  if (isVisible)
    grabFocus();
  else
    releaseFocus();
}

function backgroundClicked() {
  if (isVisible)
    changeVisibility(false);
}

function thumbClicked(event) {
  if (!isVisible)
    changeVisibility(true);
  event.stopPropagation();
}

function mounterClicked(event) {
  event.stopPropagation();
}

function newMountClicked() {
  mounterClient.onNewMount();
}

function addNewMountControl() {
  newMountControl = document.createElement('div');
  newMountControl.classList.add('mountControl');

  var spacerSpan = document.createElement('span');
  spacerSpan.classList.add('spacer');
  newMountControl.appendChild(spacerSpan);

  var addButton = document.createElement('button');
  addButton.innerHTML = '+';
  addButton.onclick = newMountClicked;
  addButton.classList.add('addOrRemoveButton');
  newMountControl.appendChild(addButton);

  mounter.appendChild(newMountControl);
}

function addMountControlItem(item, mountControl) {
  mountControl.appendChild(item);
  item.mountControl = mountControl;
}

function isValidMountPoint(mountPoint) {
  return mountPoint[0] == "/";
}

function populateMountControl(mountControl) {
  var mount = mountControl.mount;
  mountControl.pathEdit.value = mount.mountPoint;
  mountControl.pathEdit.disabled = mount.mounted;
  mountControl.localPathEdit.value = mount.localPath;
  mountControl.localPathEdit.disabled = mount.mounted;
  mountControl.selectButton.disabled = mount.mounted;
  mountControl.mountButton.disabled =
      mount.mounted ||
      (mount.entry == null) ||
      !isValidMountPoint(mount.mountPoint);
  mountControl.removeButton.disabled = mount.mounted;
  mountControl.unmountButton.disabled = !mount.mounted;
}

function mountPointChanged(event) {
  var mountControl = event.target.mountControl;
  mountControl.mount.mountPoint = event.target.value;
  populateMountControl(mountControl);
}

function chooseFolderClicked(event) {
  var mountControl = event.target.mountControl;
  mounterClient.onChooseFolder(mountControl.mount, function() {
    populateMountControl(mountControl);
  });
}

function mountClicked(event) {
  var mountControl = event.target.mountControl;
  mounterClient.onMount(mountControl.mount, function() {
    populateMountControl(mountControl);
  });
}

function unmountClicked(event) {
  var mountControl = event.target.mountControl;
  mounterClient.onUnmount(mountControl.mount, function() {
    populateMountControl(mountControl);
  });
}

function removeMountClicked(event) {
  var mountControl = event.target.mountControl;
  mounterClient.onRemoveMount(mountControl.mount);
}

function addMountControl(mount, afterElement) {
  var mountControl = document.createElement('div');
  mountControl.classList.add('mountControl');

  var selectButton = document.createElement('button');
  selectButton.innerHTML = 'Choose Folder';
  addMountControlItem(selectButton, mountControl);
  mountControl.selectButton = selectButton;
  selectButton.onclick = chooseFolderClicked;

  var localPathLabel = document.createElement('span');
  localPathLabel.innerHTML = 'Local path:';
  mountControl.appendChild(localPathLabel);

  var localPathEdit = document.createElement('input');
  localPathEdit.innerHTM = '';
  localPathEdit.readOnly = true;
  addMountControlItem(localPathEdit, mountControl);
  mountControl.localPathEdit = localPathEdit;

  var pathEditLabel = document.createElement('span');
  pathEditLabel.innerHTML = 'Mount point:';
  mountControl.appendChild(pathEditLabel);

  var pathEdit = document.createElement('input');
  pathEdit.value = mount.mountPoint;
  addMountControlItem(pathEdit, mountControl);
  mountControl.pathEdit = pathEdit;
  pathEdit.oninput = mountPointChanged;

  var mountButton = document.createElement('button');
  mountButton.innerHTML = 'Mount';
  addMountControlItem(mountButton, mountControl);
  mountControl.mountButton = mountButton;
  mountButton.onclick = mountClicked;

  var unmountButton = document.createElement('button');
  unmountButton.innerHTML = 'Unmount';
  addMountControlItem(unmountButton, mountControl);
  mountControl.unmountButton = unmountButton;
  unmountButton.onclick = unmountClicked;

  var removeButton = document.createElement('button');
  removeButton.innerHTML = '-';
  removeButton.classList.add('addOrRemoveButton');
  addMountControlItem(removeButton, mountControl);
  mountControl.removeButton = removeButton;
  removeButton.onclick = removeMountClicked;

  mountControl.mount = mount;
  populateMountControl(mountControl);

  if (afterElement) {
    mounter.insertBefore(mountControl, afterElement.nextSibling);
  } else {
    mounter.insertBefore(mountControl, mounterHeader.nextSibling);
  }

  return mountControl;
}

function preInitMounter() {
  mounterBackground = document.getElementById('mounterBackground');
  mounter = document.getElementById('mounter');
  mounterThumb = document.getElementById('mounterThumb');
  mounterHeader = document.getElementById('mounterHeader');

  mounterBackground.onclick = backgroundClicked;
  mounter.onclick = mounterClicked;
  mounterThumb.onclick = thumbClicked;

  changeVisibility(false);
}

// Mount:
//   mountPoint: string
//   localPath: string
//   entry: DirectoryEntry
//   mounted: bool

// mounterClient:
//   mounts: [Mount]
//   onChooseFolder: function(Mount)
//   onMount: function(Mount)
//   onUnmount: function(Mount)
function initMounter(makeVisible, aMounterClient) {
  mounterClient = aMounterClient;

  addNewMountControl();

  var lastMountControl = null;
  mounterClient.mounts.forEach(function(mount) {
    lastMountControl = addMountControl(mount, lastMountControl);
  });

  changeVisibility(makeVisible);

  window.onresize = function() {
    sizeBackground();
  }
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
  mounterClient.mounts.forEach(function(mount) {
    lastMountControl = addMountControl(mount, lastMountControl);
  });
}
