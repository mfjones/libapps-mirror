// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict'

wash.shared_modules = {};
wash.shared_modules.apps = {};
wash.shared_modules.handlesMounts = {};

wash.shared_modules.register = function(appName, app) {
  // Register app and app name
  wash.shared_modules.apps[appName] = app;
  wash.shared_modules.handlesMounts[appName] = false;
}

wash.shared_modules.needsMounts = function(appName) {
  wash.shared_modules.handlesMounts[appName] = true;
}
