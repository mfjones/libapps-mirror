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

wash.mounter.restoreWashMountsFromStorage = function() {
  chrome.storage.local.get('wash_mounts', function(item) {
    if (item && Array.isArray(item.wash_mounts))
      wash.mounter.mounts = item.wash_mounts;
  });
}
