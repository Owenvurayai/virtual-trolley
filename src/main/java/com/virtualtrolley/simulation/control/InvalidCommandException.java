package com.virtualtrolley.simulation.control;

/** The command is not allowed in the current state (e.g. pausing an idle simulation). Maps to HTTP 409. */
public class InvalidCommandException extends RuntimeException {

    public InvalidCommandException(String message) {
        super(message);
    }
}
