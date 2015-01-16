/*
 * Copyright (c) 2013 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

'use strict';

NaClTerm.nmf = 'vim.nmf'

function log(message) {
  console.log(message)
}

function fsErrorHandler(error) {
  // TODO(sbc): Add popup that tells the user there was an error.
  log('Filesystem error: ' + error);
}

var mounts = [];
var loaded = false;

function saveMounts() {
  if (!loaded)
    return;

  chrome.storage.local.set({'mounts': mounts}, function() {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
      return;
    }
  });
}

function mountsRestored() {
  var result = true;
  mounts.forEach(function(mount) {
    if (mount.entryId != '' && mount.entry == null || mount.needsMount) {
      result = false;
    }
  });
  return result;
}

function restoreMounts(callback) {
  chrome.storage.local.get('mounts', function(item) {
    var checkDone = function() {
      if (!mountsRestored())
        return false;

      mounts.forEach(function(mount) {
        delete mount.needsMount;
      });
      loaded = true;
      callback();
      return true;
    }

    if (item && Array.isArray(item.mounts))
      mounts = item.mounts;

    // Add in extra mounts received from wash.
    if (washMounts) {
      washMounts.forEach(function(m) {
        var found = false;

        mounts.forEach(function(existingMount) {
          if (existingMount.entryId == m.entryId) {
            found = true;
          }
        });

        if (!found) {
          var mount = {};
          mount.mountPoint = m.path;
          mount.entry = m.entry;
          mount.localPath = m.localPath;
          mount.mounted = true;
          mount.entryId = m.entryId;
          mount.needsMount = true;
          mounts.push(mount);
        }
      });
    }

    // Make sure restored state is sensible.
    mounts.forEach(function(mount) {
      mount.entry = null;
      if (mount.entryId == '') {
        mount.mounted = false;
        mount.localPath = '';
      }
      if (mount.mounted) {
        mount.mounted = false;
        mount.needsMount = true;
      }
    });

    if (checkDone())
      return;

    mounts.forEach(function(mount) {
      if (mount.entryId != '') {
        chrome.fileSystem.restoreEntry(mount.entryId, function(entry) {
          if (chrome.runtime.lastError) {
            mount.entryId = null;
          } else {
            mount.entry = entry;
            if (mount.needsMount) {
              handleMount(mount, function() {
                delete mount.needsMount;
                checkDone();
              });
              return;
            }
          }
          checkDone();
        });
      };
    });
  });
}

function addMount(mountPoint, entry, localPath, mounted) {
  var mount = {};
  mount.mountPoint = mountPoint;
  mount.entry = entry;
  mount.localPath = localPath;
  mount.mounted = mounted;
  mount.entryId = '';
  mounts.push(mount);
  saveMounts();
}

function handleChooseFolder(mount, callback) {
  chrome.fileSystem.chooseEntry({'type': 'openDirectory'}, function(entry) {
    chrome.fileSystem.getDisplayPath(entry, function(path) {
      mount.entry = entry;
      mount.entryId = chrome.fileSystem.retainEntry(entry);
      mount.localPath = path;
      mount.mountPoint = path;
      saveMounts();
      callback();
    });
  });
}

var ops = {};
var nextOpId = 0;

function handleResult(msg) {
  // Hack fake result to say the system is all up and going.
  if (msg.operation == "start") {
    initMountSystem();
    return;
  }

  if (!ops[msg.operationId]) {
    console.log('no matching op');
    return;
  }

  if (msg.result) {
    // success
    ops[msg.operationId].mount.mounted = (msg.operation == "mount");
    saveMounts();
  }
  ops[msg.operationId].callback();
  delete ops[msg.operationId];
}

function handleMount(mount, callback) {
  var mountOp = {};
  var operationId = nextOpId++;
  mountOp.mount = mount;
  mountOp.callback = callback;
  ops[operationId] = mountOp;

  var parameters = {};
  parameters.filesystem = mount.entry.filesystem;
  parameters.fullPath = mount.entry.fullPath;
  parameters.mountPoint = mount.mountPoint;
  parameters.operationId = operationId.toString();
  var message = {};
  message.mount = parameters;
  window.term_.command.processManager.foregroundProcess.postMessage(message);
}

function handleUnmount(mount, callback) {
  var unmountOp = {};
  var operationId = nextOpId++;
  unmountOp.mount = mount;
  unmountOp.callback = callback;
  ops[operationId] = unmountOp;

  var parameters = {};
  parameters.mountPoint = mount.mountPoint;
  parameters.operationId = operationId.toString();
  var message = {};
  message.unmount = parameters;
  window.term_.command.processManager.foregroundProcess.postMessage(message);
}

function handleRemoveMount(mount) {
  if (mount.mounted)
    return;

  var index = mounts.indexOf(mount);
  mounts.splice(index, 1);
  saveMounts();
  syncMounts();
}

function handleNewMount() {
  addMount('/', null, '', false);
  saveMounts();
  syncMounts();
}

function initMountSystem() {
  restoreMounts(function() {
    var mounterClient = {};
    mounterClient.mounts = mounts;
    mounterClient.onChooseFolder = handleChooseFolder;
    mounterClient.onMount = handleMount;
    mounterClient.onUnmount = handleUnmount;
    mounterClient.onRemoveMount = handleRemoveMount;
    mounterClient.onNewMount = handleNewMount;
    mounterClient.terminal = document.getElementById('terminal');
    initMounter(mounts.length == 0, mounterClient);
  });
}

function runVim() {
  NaClTerm.init();
  window.term_.command.processManager.resultHandler = handleResult;
}

function runVimWithFile(file) {
  log('runVimWithFile: ' + file.name);
  tempFS.root.getFile(file.name, {create: true},
    function(fileEntry) {
      window.tmpFileEntry = fileEntry
      fileEntry.createWriter(function(fileWriter) {
        // Note: write() can take a File or Blob object.
        fileWriter.write(file);
        log('File written to temporary filesystem\n');
        NaClTerm.argv = ['/tmp/' + file.name];
        runVim();
      }, fsErrorHandler);
    }, fsErrorHandler);
}

function runVimWithFileEntry(fileEntry) {
  window.fileEntryToSave = fileEntry;
  fileEntry.file(function(file) {
    runVimWithFile(file);
  });
}

function uploadDidChange(event) {
  var file = event.target.files[0];
  runVimWithFile(file);
}

function onInitFS(fs) {
  window.tempFS = fs

  // Once the temp filesystem is initialised we launch vim.
  // For packaged apps the fileEntryToLoad attribute will be set if the
  // user launched us with a fileEntry.  Otherwise we fallback to asking
  // them using chooseEntry.
  if (window.fileEntryToLoad !== undefined) {
    // We have fileEntry already.
    runVimWithFileEntry(window.fileEntryToLoad);
  } else if (chrome.fileSystem) {
    runVim();
/*
    // We have access the fileSystem API, so ask the user
    // to select a file.
    chrome.fileSystem.chooseEntry(function(fileEntry) {
      if (fileEntry) {
        runVimWithFileEntry(fileEntry);
      } else {
        runVim();
      }
    });
*/
  } else {
    // Fall back to using html file selection.
    var upload = document.getElementById('infile');
    if (upload !== null) {
      upload.addEventListener('change', uploadDidChange, false);
    } else {
      runVim();
    }
  }
}

function onInit() {

  navigator.webkitPersistentStorage.requestQuota(1024 * 1024,
    function(bytes) {
      window.webkitRequestFileSystem(window.TEMPORARY, bytes, onInitFS)
    },
    function() {
      log('Failed to initialize temporary file system!\n');
      // Start the terminal even if FS failed to init.
      runVim();
    }
  );
}

window.onload = function() {
  preInitMounter();
  lib.init(function() {
    onInit();
  });
};
