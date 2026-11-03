package com.virtualtrolley.api;

import com.virtualtrolley.simulation.control.InvalidCommandException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    /** A command that isn't valid in the current state is a conflict, not a server error. */
    @ExceptionHandler(InvalidCommandException.class)
    public ResponseEntity<Map<String, String>> invalidCommand(InvalidCommandException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }
}
