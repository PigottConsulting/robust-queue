/**
 * A queue which allows for non-blocking workers, failure retry, and set level of concurrency.
 * Created by wpigott on 9/25/15. *
 */
var util = require('util');
var EventEmitter = require('eventemitter3');


function Queue() {
    var self = this;
    this.concurrency = 1;
    this.worker = null;
    this.hasWorker = false;
    this.queue = [];
    this.progress = new Map();
    this.paused = true;
    this.increment = 0;

    //--- Handle Error if no listener ---//
    this.on('error', function(err) {
        if(self.listeners('error').length <= 1) {
            throw err;
        }
    });

    //--- Internal methods ---//

    this.run = function() {
        var workersToStart = Math.min(self.queue.length, Math.max(self.concurrency - self.progress.size, 0));
        for(var i = 0; i <= workersToStart; i++) {
            self.go();
        }
    }

    this.go = function() {
        if(!self.paused) {
            if(!self.hasWorker) {
                self.emit('status', 'There is no worker.  Reverting to paused.');
                self.pause();
            } else {
                var task = self.queue.shift();
                if(typeof task !== "undefined") {
                    self.progress.set(task.id, task);
                    setTimeout(self.worker(task.message, task.id, self.returnCall),0);
                }
            }
        }
    };

    this.returnCall = function(err, id){
        if(err && !(err instanceof Error)) {
            throw new Error('Non-error error returned from worker.');
        }
        if(err && err instanceof Error) {
            // There was an error.  Log it, and add it back to the front of the queue.
            self.queue.unshift(self.progress.get(id));
            self.emit('status', 'Worker failed.  Returning task to front of queue.  Error message: ' + err.message);
        }
        self.progress.delete(id);
        self.emit('task-complete', id);
    };

    this.nextIncrement = function() {
        return self.increment++;
    };
}
util.inherits(Queue, EventEmitter);

/**
 * Sets the worker which should be working on the queue.  Worker will be called with the following
 * arguments: task data, task id, callback.  Callback is expecting: error, task id.
 * @param worker function
 */
Queue.prototype.setWorker = function(worker) {
    if (typeof worker === 'function') {
        this.worker = worker;
        this.hasWorker = true;
        this.emit('new-worker', worker);
    } else {
        this.emit('error', new Error('Worker must be a valid function.'));
    }
};

/**
 *
 * @param concurrency number Integer for number of workers to operate in parallel.  Default is 1.
 */
Queue.prototype.setConcurrency = function(concurrency) {
    if(typeof concurrency === 'number' && (concurrency%1)===0) {
        this.concurrency = concurrency;
        this.emit('concurrency-change', concurrency);
    } else {
        this.emit('error', new Error('Invalid integer provided for concurrency.'));
    }
}

/**
 * Add a message to the queue.
 * @param message data to be passed to the worker.
 */
Queue.prototype.add = function(message) {
    this.queue.push({
        message: message,
        id: this.nextIncrement()
    });
    setTimeout(this.run(),0);
};

/**
 * Pause the processing of the queue.  Will not call any new workers, but will allow existing workers to complete.
 */
Queue.prototype.pause = function() {
    if(this.paused === false) {
        this.paused = true;
        this.emit('pause');
    }
};

/**
 * Resume processing of the queue.
 */
Queue.prototype.resume = function() {
    if (this.paused === true) {
        this.paused = false;
        this.emit('resume');
        setTimeout(this.run(), 0);
    }
};

/**
 * Empty the queue.
 */
Queue.prototype.clear = function() {
    this.emit('clearing');
    this.queue.length = 0;
    this.emit('cleared');
};

module.exports = Queue;