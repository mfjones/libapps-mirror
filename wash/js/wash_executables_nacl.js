// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// NaCl wash executables.

wash.executables.nacl = {};

wash.executables.nacl.install = function(jsfs, path, onSuccess, onError) {
  var exes = {};
  for (var key in wash.executables.nacl.callbacks) {
    var callback = wash.executables.nacl.callbacks[key];
    exes[key] = new wam.jsfs.Executable(callback);
  }

  jsfs.makeEntries(path, exes, onSuccess, onError);
};

wash.executables.nacl.runNaClApp = function(executeContext, name, optionalArgs) {
  executeContext.ready();
  window.NaClTerm.nmf = name + '.nmf';

  if (typeof optionalArgs === "undefined")
    window.NaClTerm.argv = executeContext.arg;
  else {
    if (executeContext.arg)
      optionalArgs.concat(executables.arg);
    window.NaClTerm.argv = optionalArgs;
  }

  window.NaClTerm.init();
  window.tw_.term.command.processManager.resultHandler =
      wash.mounter.handleResult;

  executeContext.closeOk(null);
}

wash.executables.nacl.callbacks = {};

wash.executables.nacl.callbacks['vim'] = function(executeContext) {
  wash.executables.nacl.runNaClApp(executeContext, 'vim');
}

wash.executables.nacl.callbacks['ruby'] = function(executeContext) {
  wash.executables.nacl.runNaClApp(executeContext, 'ruby');
}

wash.executables.nacl.callbacks['irb'] = function(executeContext) {
  wash.executables.nacl.runNaClApp(executeContext, 'ruby', ['/bin/irb']);
}
