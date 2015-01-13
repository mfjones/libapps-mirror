'use strict'

wash.mounted = {};
wash.mounted.mounts = [];

wash.mounted.mount = function(entryId, localPath, path) {
  this.entryId = entryId;
  this.localPath = localPath;
  this.path = path;
}

wash.mounted.addMount = function(entryId, localPath, path) {
  var m = new wash.mounted.mount(entryId, localPath, path);
  wash.mounted.mounts.push(m);
}

wash.mounted.getEntryWithId = function(entryId, callback, callbackError) {
  chrome.fileSystem.isRestorable(entryId, function(isRestorable) {
    if (isRestorable)
      chrome.fileSystem.restoreEntry(entryId, callback);
    else
      callbackError();
  });
}

// Assuming top level paths are unique
wash.mounted.getRootDirectory = function(path, callback, callbackError) {
  // Get the top level path
  var path = "/" + path.split('/')[1];
  var found = false;
  wash.mounted.mounts.forEach(function(mount) {
    if (mount.path === path) {
      found = true;
      wash.mounted.getEntryWithId(mount.entryId, callback, callbackError);
    }
  });

  if (!found)
    callbackError();
}
