const JestBenchmarkEnvironment = require("jest-bench/environment");
const symDescribeStack = Symbol.for("deoptexplorer-benchmark-describe-stack");
const symTestName = Symbol.for("deoptexplorer-benchmark-running-test");

class BenchmarkEnvironment extends JestBenchmarkEnvironment {
    /**
     * 
     * @param {import("jest-circus").Event} event 
     * @param {import("jest-circus").State} state 
     */
    handleTestEvent(event, state) {
        switch (event.name) {
            case 'test_start': {
                this.global[symTestName] = event.test.name;
                break;
            }
            case 'test_done': {
                this.global[symTestName] = undefined;
                break;
            }
            case 'start_describe_definition': {
                const top = this.global[symDescribeStack];
                this.global[symDescribeStack] = { name: state.currentDescribeBlock.name, next: top };
                break;
            }
            case 'finish_describe_definition': {
                const top = this.global[symDescribeStack];
                this.global[symDescribeStack] = top?.next;
                break;
            }
        }
    }
}

module.exports = BenchmarkEnvironment;
module.exports.default = BenchmarkEnvironment;
