#!/usr/bin/env node

var seaport = require('seaport')
  , cc = require('config-chain')
  , path = require('path')
  , fs = require('fs')
  , log = require('npmlog')
  , optimist = require('optimist')

var argv = optimist
  .describe('h', 'Seaport hostname')
  .alias('h', 'host')

  .describe('p', 'Seaport port (required)')
  .alias('p', 'port')

  .describe('q', 'Quiet mode')
  .alias('q', 'quiet')

  .describe('k', 'Seaport key file (see Seaport documentation)')
  .alias('k', 'key')

  .describe('help', 'Displays this help message')
  .argv


if (argv.help) {
  optimist.showHelp()
  return
}


log.heading = 'nodeport'


var file


var conf = cc( argv , cc.env('NODEPORT_') )

file = path.resolve('.nodeport')
if (fs.existsSync(file))
  conf.addFile(file, 'ini', 'local')

file = path.resolve(process.env.HOME, '.nodeport')
if (fs.existsSync(file))
  conf.addFile(file, 'ini', 'global')


// Defaults config
conf.root = {}
conf.root.host = '127.0.0.1'


if (conf.get('quiet')) {
  log.level = 'silent'
} else {
  log.level = conf.get('loglevel')
}



if (!conf.get('port')) {
  log.error('Missing seaport port')
  return
}


var main
  , role
  , meta = {}

file = path.resolve(argv._[0])

var pkgFile = path.basename(file) == 'package.json' ? file : path.join(file, 'package.json')
if (fs.existsSync( pkgFile )) {
  var pkg = require(pkgFile)

  if (pkg.nodeport) main = pkg.nodeport
  else if (pkg.main) main = pkg.main
  else if (pkg.scripts && pkg.scripts.start) main = pkg.scripts.start

  if (main) main = path.resolve(path.dirname(pkgFile), main)

  role = pkg.name + '@' + pkg.version
  if (pkg.seaport) meta = pkg.seaport
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
  log.error(err)
  log.error('Failed to load main')
  return
}

if (!main.listen) {
  log.error('Main must have a listen method')
  return
}

var opts = conf.get('key') && JSON.parse(fs.readFileSync(path.resolve(conf.get('key')), 'utf8')) || {}

var ports = seaport.connect(conf.get('port'), conf.get('host'), opts)

main.listen(ports.register(role, meta))


process.on('SIGINT', function() {
  log.info('Got SIGINT, closeing seaport connection')
  ports.close()
  if (typeof main.close === 'function') main.close()
})
