#!/usr/bin/env node

//checks if litesvm .node file exists for current platform
//exits 0 (success) if found, exits 1 (failure) if build needed

const Module = require("module");
const path = require("path");
const fs = require("fs");

const originalRequire = Module.prototype.require;
const liteSvmDir = "../src/liteSvm";

//mock require to check each attempted .node file required by internal.js
Module.prototype.require = function(id) {
  const filename = path.basename(id);
    
  if (!filename.startsWith("litesvm.") || !filename.endsWith(".node"))
    return originalRequire.apply(this, arguments);

  if (fs.existsSync(path.join(__dirname, liteSvmDir, filename)))
    process.exit(0);
  
  const err = new Error(`Cannot find module "${id}"`);
  err.code = "MODULE_NOT_FOUND";
  throw err;
};

//check if internal.js exists first - if not, we definitely need to build
const internalPath = path.join(__dirname, liteSvmDir, "internal.js");
if (!fs.existsSync(internalPath))
  process.exit(1);

//import the detection logic from internal.js (triggers its require attempts)
try { require(internalPath) } catch (err) {}

//if we get here, internal.js exists but no compatible .node file was found
process.exit(1);
