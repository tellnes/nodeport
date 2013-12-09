#!/usr/bin/env node

var seaport = require('seaport')
  , cc = require('config-chain')
  , path = require('path')
  , fs = require('fs')
  , optimist = require('optimist')
  , debug = require('debug')('nodeport')


function extend(dest, src) {
  Object.keys(src).forEach(function (key) {
    dest[key] = src[key]
  })
}


var argv = optimist
  .describe('h', 'Seaport hostname')
  .alias('h', 'host')

  .describe('p', 'Seaport port (required)')
  .alias('p', 'port')

  .describe('q', 'Quiet mode')
  .alias('q', 'quiet')

  .describe('k', 'Seaport key file (see Seaport documentation)')
  .alias('k', 'key')

  .describe('r', 'Seaport role')
  .alias('r', 'role')

  .describe('m', 'Main file')
  .alias('m', 'main')

  .describe('help', 'Displays this help message')
  .argv


if (argv.help) {
  optimist.showHelp()
  return
}


var conf = cc( argv
             , cc.env('NODEPORT_')
             )

var file = cc.find('.nodeport')
if (file)
  conf.addString(fs.readFileSync(file))


// Defaults config
conf.root = {}
conf.root.host = '127.0.0.1'



if (!conf.get('port')) {
  throw 'NODEPORT: Missing seaport port'
}


var main = conf.get('main')
  , role = conf.get('role')
  , meta = {}

if (main) main = path.resolve(process.cwd(), main)

file = path.resolve(argv._[0] || '')

var pkgFile = path.basename(file) == 'package.json' ? file : path.join(file, 'package.json')
if (fs.existsSync( pkgFile )) {
  var pkg = require(pkgFile)

  if (!main) {
    if (pkg.nodeport) main = pkg.nodeport
    else if (pkg.main) main = pkg.main
    else if (pkg.scripts && pkg.scripts.start) main = pkg.scripts.start

    if (main) main = path.resolve(path.dirname(pkgFile), main)
  }

  if (!role) {
    role = pkg.name + '@' + pkg.version
  }

  meta.serverRoot = path.dirname(pkgFile)

  if (pkg.seaport) extend(meta, pkg.seaport)
}

if (!main) {
  main = path.join(file, 'server.js')
  if (!fs.existsSync(main)) {
    main = file
  }
}

if (!role) {
  role = path.basename(file)
}

try {
  main = require(main)
} catch(err) {
  console.error('NODEPORT: Failed to load main')
  throw err
}

if (!main.listen) {
  throw 'NODEPORT Main must have a listen method'
}

var opts = conf.get('key') && JSON.parse(fs.readFileSync(path.resolve(conf.get('key')), 'utf8')) || {}

var ports = seaport.connect(conf.get('port'), conf.get('host'), opts)

var argMeta = conf.get('meta')
if (typeof argMeta === 'string') {
  argMeta = JSON.parse(fs.readFileSync(path.resolve(argMeta), 'utf8')) || {}
}
if (typeof argMeta === 'object') {
  extend(meta, argMeta)
}


var server = main.listen(ports.register(role, meta))


process.once('SIGINT', function () {
  debug('Got SIGINT, closeing')
  ports.close()
  if (typeof main.close === 'function') main.close()
  else if (typeof server.close === 'function') server.close()
})
