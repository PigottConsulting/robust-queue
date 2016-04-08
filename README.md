# Robust Queue
## Overview
Robust queue is a queue which is disgned from the ground up to meet the following requirements.
* Fast Performance (non-blocking)
* Easy to use
* Retries tasks on failure
* Emits Events
* Configurable Worker and Concurrency
* Allows workers to be paused and resumed.
* Allows jobs to be grouped.  IE.  Only start a worker when there are 10 tasks in queue, and send all of them to a single worker.

This has been tried with 1,200+ messages per second flowing through it in single concurreny.  With concurrency of 100, it will easily handle 5,000+/sec.  The queue can be paused and a backlog of 50,000+ messages accumulated without issue.  I have not tested more than this, but there is no reason to think it will fail until you run out of memory to store the backlog in.

## Quick Start
To use, simply start a new queue, give it a worker function, un-pause, and start adding tasks.

Initialize
```
var Queue = require('robust-queue');
var q = new Queue();
```

Set the worker for the queue to handle the task.
```
function worker(task, id, cb) {
    console.log(task);
    cb(null, id);
}
q.setWorker(worker);
```

Start the queue (resume).
```
q.resume();
```

Add a task.
```
q.add("This is a task");
```

## Worker
The worker must be a callable function, and should take 3 arguments in.
1. Task - The data of the task which was submitted through the "add" function.
2. Id - The internal ID of the task.  This is used to mark complete or for retry.
3. Callback - The method to call upon completion or error.

The callback method takes two arguments, bot of which are required.
1. Error - null if there is no error.  On an error, an object of type Error should be returned.
2. Id - The id that was passed into the worker function.

### Worker succeeds example (no grouping)
The worker function calls the callback with no error, and the id of the task so it can be marked complete and purged from the queue.
```
function worker(task, id, cb) {
    // Do something
    cb(null, id);
}
```

### Worker fails example (no grouping)
When a worker fails to complete a task, it must return an Error object, and the id.  The task will then be put on the front of the queue and retried.
```
function worker(task, id, cb) {
    // Fail to do something
    cb( new Error('Failed'), id);
}
```

### Worker succeeds example (with grouping)
The worker function takes a Map object of id:task.  The 2nd argument is undefined.  The worker function calls the callback for each task with no error, and the id of the task so it can be marked complete and purged from the queue.
```
function worker(tasks, undef, cb) {
    tasks.forEach(function(value, key, map){
        // Do something
        cb(null, key);
    });
}
```

### Worker fails example (with grouping)
When a worker fails to complete a task, it must call the callback with an Error object, and the id for each task that failed.  The task will then be put on the front of the queue and retried.
```
function worker(tasks, undef, cb) {
    tasks.forEach(function(value, key, map){
        // Fail to do something
        cb( new Error('Failed'), key);
    });
}
```

## Grouping
Grouping allows tasks to be grouped and sent to a single worker.  IE.  A worker will receive 5 tasks instead of 1 if the grouping is enabled and a grouping number of 5 is set.

You should remember to flush the queue at the end if it is a short living queue, as tasks could be piled up waiting for the minimum number of tasks to accumulate before sendin a group to a worker.  Flushing will group all outstanding tasks and send them to a single worker.

## Methods
### setWorker(worker)
Sets the worker which the queue will dispatch each task to.  Must be a function.  If the worker is not set, the queue will return to paused and emit a status event.

### setConcurrency(concurrency)
(Optional) Allows the concurrency of the queue to be changed anytime.  The default is 1.
Concurrency is the number of workers which can be processing at the same time.

### add(task)
Adds the task to the queue.

### pause()
Pauses the queue processor.  Tasks can still be added.  Any workers in process will not be stopped, but new workers will not be started.

### resume()
Resumes the queue processor.

### clear()
Clears the entirety of the queue.  Any tasks in progress are not removed.

### setGroupingNum(num)
Sets the number of tasks to group and pass to a single worker.

### setGroupingIsEnabled(bool)
Enables or disables the grouping functionality.

### flush()
Forces all outstanding tasks to be sent to a single worker.  This is only applicable if grouping is enabled.  This should be used when ending a queue to make sure all tasks are processed.  The queue must not be paused when this is called.  Once in the flush state, a queue cannot be returned to normal.

## Events
### status
Emits a string explaining what is going on in the queue.  Useful for logging.  Status is emitted when a worker fails and the task is returned to the queue.

### task-complete
Emits an integer representing the internal task id.  This is emitted anytime a worker returns weather successful or not.

### new-worker
Emits the worker when the worker on the queue is changed.

### error
Emits an Error object whenever an error occurs.  If a listener is not defined for this event, the error is thrown and will stop execution.

### concurrency-change
Emits the concurrency when the concurrency of the queue is changed.

### pause
Notifies when the queue is paused.

### resume
Notifies when the queue resumes.

### clearing
Notifies immediately before clearing the queue.  Can be leveraged to save data.

### cleared
Notifies immediately after clearing the queue.  Can be leveraged to load any tasks at the beginnign of the queue.

## Error handling
Errors can be captured by listening on the "error" event.  An Error object will be emitted with the event for handling.  

If there is no listener, the default is to throw the error which will stop execution.

The only time an Error is thrown from the module is when the worker function returns a value in the first argument of the callback, that is not an instance of Error.
