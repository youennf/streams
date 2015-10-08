ReadableStream
 - locked               reader management
 - cancel               delegates to reader
 - getReader            reader management
 - pipeThrough          simple sugar
 - pipeTo               more complex. might vary per stream impl.
 - tee                  more complex. might var per stream impl.

 - [[closeRequested]]   state machine/queue; underlying source interface
   - reader.read()
   - ShouldReadableStreamPull (i.e. interface with underlying source)
   - controller.close()
   - controller.enqueue()
   - controller.close()
 - [[controller]]       pointer to another thingy
 - [[disturbed]]        state machine/queue
 - [[pullAgain]]        underlying source interface
 - [[pulling]]          underlying source interface
 - [[queue]]            queue
 - [[reader]]           reader management
 - [[started]]          state machine (could probably merge with [[state]])
 - [[state]]            state machine
 - [[storedError]]      "queue" in some sense
 - [[strategySize]]     underlying source interface
 - [[strategyHWM]]      underlying source interface
 - [[underlyingSource]] underlying source interface

ReadableStreamReader
 - closed
 - cancel
 - read
 - releaseLock

 - [[closedPromise]]    state machine. GC subtleties.
 - [[ownerReadableStream]]
 - [[readRequests]]

ReadableStreamController
 - desiredSize
 - close
 - enqueue
 - error

What does a pure ReadableStream need, from a public API perspective only?
 - reader management:
     + [[reader]], reader's [[ownerReadableStream]], reader releaseLock
 - reading capabilities:
     + read next chunk (reader.read)
     + cancel w/ reason (reader.cancel)
     + possible specialized algorithms: pipeTo; tee
     + invariants:
         * after cancel, read next chunk must always give { done: true }
