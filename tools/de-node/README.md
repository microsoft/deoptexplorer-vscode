# `de-node` - Commandline Utility for [Deopt Explorer][].

`de-node` is a commandline wrapper for the NodeJS executable (`node`) designed to simplify the process of launching Node
with the necessary arguments required to produce a log that can be consumed by [Deopt Explorer][]. When launched,
`de-node` will attempt to determine the correct logging and tracing options based on the detected version of NodeJS.

# Installation

```
npm install --global de-node
```

# Usage

```
de-node [options] [--] <executable> [executable_options]
options:
  -h --help        print this message
     --no-maps     exclude v8 maps from log
     --no-ics      exclude ics from log
     --no-deopts   exclude deopts from log
     --no-profile  exclude cpu profile from log
     --no-sources  exclude sources from log
     --no-quiet    write de-node messages to stdout (default)
     --maps        include v8 maps in log (default)
     --ics         include ics in log (default)
     --deopts      include deopts in log (default)
     --profile     include cpu profile in log (default)
     --sources     include sources in log (default)
     --quiet       do not write de-node messages to stdout
     --out FILE    write all log output to FILE (default: isolate-<pid>-<isolate id>-v8.log)
     --            pass all remaining arguments to node
```

[Deopt Explorer]: https://github.com/rbuckton/deoptexplorer-vscode