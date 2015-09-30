/**
 * A queue which allows for non-blocking workers, failure retry, and set level of concurrency.
 * Created by wpigott on 9/25/15. *
 */
var util = require('util');
var EventEmitter = require('eventemitter3');


function Queue() {
    var self = this;
    var concurrency = 1;
    var worker = null;
    var hasWorker = false;
    var queue = [];
    var progress = new Map();
    var paused = true;
    var increment = 0;

    //--- Handle Error if no listener ---//
    this.on('error', function(err) {
        if(self.listeners('error').length <= 1) {
            throw err;
        }
    });

    //--- Private methods ---//

    function run() {
        var workersToStart = Math.min(queue.length, Math.max(concurrency - progress.size, 0));
        for(var i = 0; i <= workersToStart; i++) {
            go();
        }
    }

    function go() {
        if(!paused) {
            if(!hasWorker) {
                self.emit('status', 'There is no worker.  Reverting to paused.');
                self.pause();
            } else {
                var task = queue.shift();
                if(typeof task !== "undefined") {
                    progress.set(task.id, task);
                    setTimeout(worker(task.message, task.id, returnCall),0);
                }
            }
        }
    };

    function returnCall(err, id){
        if(err && !(err instanceof Error)) {
            throw new Error('Non-error error returned from worker.');
        }
        if(err && err instanceof Error) {
            // There was an error.  Log it, and add it back to the front of the queue.
            queue.unshift(progress.get(id));
            self.emit('status', 'Worker failed.  Returning task to front of queue.  Error message: ' + err.message);
        }
        progress.delete(id);
        self.emit('task-complete', id);
    };

    function nextIncrement() {
        return increment++;
    };

    //--- Privileged Methods ---//

    /**
     * Sets the worker which should be working on the queue.  Worker will be called with the following
     * arguments: task data, task id, callback.  Callback is expecting: error, task id.
     * @param worker function
     */
    this.setWorker = function(tempWorker) {
        if (typeof tempWorker === 'function') {
            worker = tempWorker;
            hasWorker = true;
            self.emit('new-worker', worker);
        } else {
            self.emit('error', new Error('Worker must be a valid function.'));
        }
    };

    /**
     *
     * @param concurrency number Integer for number of workers to operate in parallel.  Default is 1.
     */
    this.setConcurrency = function(tempConcurrency) {
        if(typeof tempConcurrency === 'number' && (tempConcurrency%1)===0) {
            concurrency = tempConcurrency;
            self.emit('concurrency-change', concurrency);
        } else {
            self.emit('error', new Error('Invalid integer provided for concurrency.'));
        }
    }

    /**
     * Add a message to the queue.
     * @param message data to be passed to the worker.
     */
    this.add = function(message) {
        queue.push({
            message: message,
            id: nextIncrement()
        });
        setTimeout(run(),0);
    };

    /**
     * Pause the processing of the queue.  Will not call any new workers, but will allow existing workers to complete.
     */
    this.pause = function() {
        if(paused === false) {
            paused = true;
            self.emit('pause');
        }
    };

    /**
     * Resume processing of the queue.
     */
    this.resume = function() {
        if (paused === true) {
            paused = false;
            self.emit('resume');
            setTimeout(run(), 0);
        }
    };

    /**
     * Empty the queue.
     */
    this.clear = function() {
        this.emit('clearing');
        queue.length = 0;
        this.emit('cleared');
    };
}

util.inherits(Queue, EventEmitter);

module.exports = Queue;