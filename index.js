#!/usr/bin/env node
'use strict';

import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs';
import glob from 'glob';
import glob2base from 'glob2base';
import imagemin from 'imagemin';
import minimist from 'minimist';
import path from 'path';
import prettyBytes from 'pretty-bytes';

const argv = minimist(process.argv.slice(2), {
  string: ['dir', 'config'],
  boolean: ['watch'],
  alias: {
    d: 'dir',
    c: 'config',
    w: 'watch'
  },
  default: {
    config: 'imagemin.config.json'
  }
});

const pattern = argv._[0];
const base = glob2base(glob(pattern));
argv.dir = argv.dir || base;

const config = fs.existsSync(argv.config) ? JSON.parse(fs.readFileSync(argv.config)) : {};
const plugins = [];

for (const [key, value] of Object.entries(config)) {
  await import(`imagemin-${key}`).then(module => {
    plugins.push(module.default(value));
  }).catch(error => {
    console.error(chalk.red(error));
  });
}

const minify = async (file) => {
  const files = file ? [file] : glob.sync(pattern);

  for (const file of files) {
    const output = path.join(argv.dir, path.relative(base, file));
    const result = await imagemin([file], {
      destination: path.dirname(output),
      glob: false,
      plugins: plugins
    }).catch(error => {
      console.error(chalk.red(error));
    });
    if (!result) continue;

    const { size: original } = fs.statSync(file);
    const saved = original - result[0].data.length;
    const percent = saved / original * 100;
    const message = `Minified: ${output} (saved ${prettyBytes(saved)} - ${percent.toFixed(1)}%)`;
    console.log(chalk.blue(message));
  }
};

if (argv.watch) {
  const watcher = chokidar.watch(pattern, {
    ignoreInitial: true
  });
  watcher.on('all', (eventName, file) => {
    if (eventName == 'unlink') return;
    minify(file);
  });
} else {
  minify();
}
