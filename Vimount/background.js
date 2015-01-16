/*
 * Copyright (c) 2013 The Native Client Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

'use strict';

function fsErrorHandler(error) {
  // TODO(sbc): Add popup that tells the user there was an error.
  console.log('Filesystem error: ' + error);
}

/**
 * Copyies one FileEntry object to another.  This is used to copy from
 * the TEMPORARAY filesystem in which the lauched files is edited back
 * to the entry that was passed at launch time.
 */
function copyFile(srcFile, destFile) {
  console.log('copyFile: ' + srcFile.name + ' -> ' + destFile.name);

  srcFile.file(function(file) {
    destFile.createWriter(function(writer) {
      writer.onerror = fsErrorHandler;
      var doneTruncate = false;
      writer.onwriteend = function(e) {
        if (!doneTruncate) {
          console.log('done truncate');
          doneTruncate = true;
          writer.seek(0);
          writer.write(file);
        } else {
          console.log('done write');
          console.log(e);
        }
      };
      writer.truncate(file.size);
    }, fsErrorHandler);
  }, fsErrorHandler);
}

function saveFile(saveFileEntry) {
  window.webkitRequestFileSystem(window.TEMPORARY, 0, function(tmpFS) {
    tmpFS.root.getFile(saveFileEntry.name, {create: false},
      function(tmpFileEntry) {
        copyFile(tmpFileEntry, saveFileEntry);
      }
    );
  });
}

function launchVim(fileEntry, mounts) {
  function onWindowCreated(win) {
    win.contentWindow.fileEntryToLoad = fileEntry;
    if (fileEntry)
      console.log('Lauching vim with item: ' + fileEntry);
    else
      console.log('Lauching vim without items');

    function onWindowClosed() {
      console.log('onWindowClosed');

      if (win.contentWindow.fileEntryToSave) {
        saveFile(win.contentWindow.fileEntryToSave);
      }
    }

    vimount.appWin = win.contentWindow.window;
    vimount.appWin.washMounts = mounts;
    win.onClosed.addListener(onWindowClosed);
  }

  var props = {
    width: 600,
    height: 600
  };

  chrome.app.window.create('_modules/cpefnblmmeilonjccjohpnhhhlodpbfj/vim_app.html', props, onWindowCreated);
}

function onLaunchedListener(launchData) {
  var fileEntry;
  if (launchData.items)
    fileEntry = launchData.items[0].entry;
  launchVim(fileEntry);
}

// chrome.app.runtime.onLaunched.addListener(onLaunchedListener);

var vimount = {};
vimount.appWin = null;

vimount.SMmain = function(mounts) {
  var fileEntry;
  launchVim(fileEntry, mounts);
}

vimount.registerSelf = function() {
  wash.shared_modules.register("vimount", this);
  wash.shared_modules.needsMounts("vimount");
}

vimount.handleAddMount = function(newMount) {
  vimount.appWin.mounts &&
    vimount.appWin.mounts.forEach(function(existingMount) {
      if (existingMount.entryId == newMount.entryId)
        return;
    });

  var mount = {};
  mount.mountPoint = newMount.path;
  mount.entry = newMount.entry;
  mount.localPath = newMount.localPath;
  mount.mounted = true;
  mount.entryId = newMount.entryId;
  mount.needsMount = true;
  vimount.appWin.mounts.push(mount);
  var mountControl = vimount.appWin.addMountControl(mount, null);
  vimount.appWin.mounterClient.onMount(mountControl.mount, function() {
    vimount.appWin.populateMountControl(mountControl);
  });
}

vimount.handleRemoveMount = function(mount) {
  vimount.appWin.handleRemoveMount(mount);
}

vimount.isRunning = function() {
  return vimount.appWin !== null;
}

vimount.registerSelf();
