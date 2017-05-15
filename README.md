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
lex DEFID|TAG|LEXID ([A-Za-z0-9_-]+)\s*
lex PIPE            \|\s*
lex REGEXP          (.+)

lex POSTOP         ([?+-])\s*
lex BROP           \(\s*
lex BRCL           \)\s*

def GROUP
	seq BROP EXPR BRCL
	seq DEFID|LEXID

def POSTFIX
	seq GROUP POSTOP?

def SEQ
	seq POSTFIX+

def EXPR
	seq SEQ (PIPE SEQ)*

rule lex LEXID (PIPE LEXID)* REGEXP

rule def DEFID
	rule seq SEQ
	rule case TAG (PIPE TAG)* SEQ

rule rule TAG (PIPE TAG)* ARGUMENTS
	children rule
	rule children TAG (PIPE TAG)*

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
