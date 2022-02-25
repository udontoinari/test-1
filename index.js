#!/usr/bin/env node
'use strict';

import fs from 'fs';
import { dirname, join, relative } from 'path';
import minimist from 'minimist';
import glob from 'glob';
import glob2base from 'glob2base';
import imagemin from 'imagemin';
import prettyBytes from 'pretty-bytes';
import chokidar from 'chokidar';
import chalk from 'chalk';

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
const config = fs.existsSync(argv.config)
  ? JSON.parse(fs.readFileSync(argv.config, 'utf8'))
  : {};
const plugins = [];

for (const [key, value] of Object.entries(config)) {
  await import(`imagemin-${key}`).then(module => {
    plugins.push(module.default(value));
  }).catch(error => {
    console.error(chalk.red(error));
  });
}

const minify = async (path) => {
  const paths = path ? [path] : glob.sync(pattern);

  for (const path of paths) {
    const output = join(argv.dir, relative(base, path));
    const result = await imagemin([path], {
      destination: dirname(output),
      glob: false,
      plugins: plugins
    });
    const { size: original } = fs.statSync(path);
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
  watcher.on('ready', () => {
    // console.log(chalk.gray('Sass is watching for changes. Press Ctrl-C to stop.'));
    console.log(chalk.gray('Watching images... Press Ctrl-C to stop.'));
  });
  watcher.on('all', (eventName, path) => {
    if (eventName == 'unlink') return;
    minify(path);
  });
} else {
  minify();
}
