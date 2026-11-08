package com.virtualtrolley.simulation.control;

/** Port: how a state snapshot leaves the application (STOMP today). */
@FunctionalInterface
public interface StateSender {

    void send(SimulationSnapshot state);
}
