import { Operation, OperationStatus } from './operation-stream';
import { WritableStream } from './writable-stream';
import { ReadableStream } from './readable-stream';

class OperationQueueShared {
  constructor(strategy) {
    this._shared = [];
    this._sharedSize = 0;

    this._strategy = strategy;
  }
}

class OperationQueueUnderlyingSink {
  _updateWritableStream() {
    if (this._shared._strategy === undefined) {
      return;
    }

    let shouldApplyBackpressure = false;
    if (this._shared._strategy.shouldApplyBackpressure !== undefined) {
      shouldApplyBackpressure = this._shared._strategy.shouldApplyBackpressure(this._shared._queueSize);
    }
    if (shouldApplyBackpressure) {
      this._delegate.markWaiting();
    } else {
      this._delegate.markWritable();
    }

    this._delegate.onSpaceChange();
  }

  constructor(queue) {
    this._shared = queue;
  }

  setSource(source) {
    this._source = source;
  }

  init(delegate) {
    this._delegate = delegate;

    this._updateWritableStream();
  }

  get space() {
    if (this._shared._strategy.space !== undefined) {
      return this._shared._strategy.space(this._shared._queueSize);
    }

    return undefined;
  }

  write(value) {
    const operationStatus = new OperationStatus();
    const operation = new Operation('data', value, operationStatus);

    var size = 1;
    if (this._shared._strategy.size !== undefined) {
      size = this._shared._strategy.size(operation.argument);
    }

    this._shared._queue.push({value: operation, size});
    this._shared._queueSize += size;

    this._updateWritableStream();

    this._source.onQueueFill();

    return operationStatus;
  }

  close() {
    const operationStatus = new OperationStatus();
    const operation = new Operation('close', ReadableStream.EOS, operationStatus);

    this._shared._queue.push({value: operation, size: 0});

    // No longer necessary.
    this._shared._strategy = undefined;

    this._source.onQueueFill();

    return operationStatus;
  }

  abort(reason) {
    const operationStatus = new OperationStatus();
    const operation = new Operation('abort', reason, operationStatus);

    for (var i = this._shared._queue.length - 1; i >= 0; --i) {
      const op = this._shared._queue[i].value;
      op.error(new TypeError('aborted'));
    }
    this._shared._queue = [];

    this._shared._strategy = undefined;

    this._source.abort(operation);

    return operationStatus;
  }

  onWindowUpdate() {
    this._updateWritableStream();
  }

  onQueueConsume() {
    this._updateWritableStream();
  }

  onCancel(reason) {
    this._delegate.markErrored(reason);
  }
}

class OperationQueueUnderlyingSource {
  constructor(shared) {
    this._shared = shared;
  }

  setSink(sink) {
    this._sink = sink;
  }

  init(delegate) {
    this._delegate = delegate;
  }

  onQueueFill() {
    this._delegate.markReadable();
  }

  abort(reason) {
    this._delegate.markErrored(reason);
  }

  onWindowUpdate(v) {
    if (this._shared._strategy === undefined) {
      return;
    }

    if (this._shared._strategy.onWindowUpdate !== undefined) {
      this._shared._strategy.onWindowUpdate(v);
    }

    this._sink.onWindowUpdate();
  }

  read() {
    if (this._shared._queue.length === 0) {
      throw new TypeError('not readable');
    }

    const entry = this._shared._queue.shift();
    this._shared._queueSize -= entry.size;

    if (this._shared._queue.length === 0) {
      if (entry.value.type === 'close') {
        this._delegate.markDrained();
      } else {
        this._delegate.markWaiting();
      }
    }

    this._sink.onQueueConsume();

    return entry.value;
  }

  cancel(reason) {
    const operationStatus = new OperationStatus();
    const operation = new Operation('cancel', reason, operationStatus);

    for (var i = 0; i < this._shared._queue.length; ++i) {
      const op = this._shared._queue[i].value;
      op.error(operation.argument);
    }
    this._shared._queue = [];

    this._shared._strategy = undefined;

    this._sink.onCancel(operation);

    return operationStatus;
  }
}


// Creates a pair of WritableStream implementation and ReadableStream implementation that are
// connected with a queue. This can be used for creating queue-backed operation streams.
export function createOperationQueue(strategy) {
  const queue = new OperationQueueShared(strategy);
  const source = new OperationQueueUnderlyingSource(queue);
  const sink = new OperationQueueUnderlyingSink(queue);
  sink.setSource(source);
  source.setSink(sink);
  return { writable: new WritableStream(sink), readable: new ReadableStream(source) };
}
