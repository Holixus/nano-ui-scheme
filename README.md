[![Gitter][gitter-image]][gitter-url]
[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]


# nano-ui-scheme
UI-files scheme compiler and validator

## Scheme of ui-scheme
```
lex LEXIDS         ([A-Za-z0-9_-]+(?:\s*\|\s*[A-Za-z0-9_-]+)*)
lex DEFID          ([A-Za-z0-9_-]+)
lex TAGS|CHILDREN  ([a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*)
lex SP             \s+
lex ARGUMENTS|ANY  (.+)

rule lex LEXIDS SP ARGUMENTS

rule def DEFID
	rule seq ANY
	rule case TAGS SP ANY

rule rule TAGS SP ARGUMENTS
	children rule
	rule children TAGS

root-rule lex | root-rule | rule | def
```

[bithound-image]: https://www.bithound.io/github/Holixus/nano-ui-scheme/badges/score.svg
[bithound-url]: https://www.bithound.io/github/Holixus/nano-ui-scheme

[gitter-image]: https://badges.gitter.im/Holixus/nano-ui-scheme.svg
[gitter-url]: https://gitter.im/Holixus/nano-ui-scheme

[npm-image]: https://badge.fury.io/js/nano-ui-scheme.svg
[npm-url]: https://badge.fury.io/js/nano-ui-scheme

[github-tag]: http://img.shields.io/github/tag/Holixus/nano-ui-scheme.svg
[github-url]: https://github.com/Holixus/nano-ui-scheme/tags

[travis-image]: https://travis-ci.org/Holixus/nano-ui-scheme.svg?branch=master
[travis-url]: https://travis-ci.org/Holixus/nano-ui-scheme

[coveralls-image]: https://coveralls.io/repos/github/Holixus/nano-ui-scheme/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/Holixus/nano-ui-scheme?branch=master

[david-image]: https://david-dm.org/Holixus/nano-ui-scheme.svg
[david-url]: https://david-dm.org/Holixus/nano-ui-scheme

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: LICENSE

[downloads-image]: http://img.shields.io/npm/dt/nano-ui-scheme.svg
[downloads-url]: https://npmjs.org/package/nano-ui-scheme
