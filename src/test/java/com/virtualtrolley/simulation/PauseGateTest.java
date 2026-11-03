package com.virtualtrolley.simulation;

import com.virtualtrolley.simulation.control.PauseGate;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class PauseGateTest {

    @Test
    void openGateDoesNotBlock() throws Exception {
        new PauseGate().awaitOpen(); // would hang the test if it blocked
    }

    @Test
    void pausedGateBlocksUntilResumed() throws Exception {
        PauseGate gate = new PauseGate();
        gate.pause();

        CompletableFuture<Void> waiter = CompletableFuture.runAsync(() -> {
            try {
                gate.awaitOpen();
            } catch (InterruptedException e) {
                throw new IllegalStateException(e);
            }
        });

        Thread.sleep(150);
        assertFalse(waiter.isDone(), "must stay parked while paused");

        gate.resume();
        waiter.get(2, TimeUnit.SECONDS);
    }

    @Test
    void pausedWaiterCanBeInterrupted() throws Exception {
        PauseGate gate = new PauseGate();
        gate.pause();
        AtomicBoolean interrupted = new AtomicBoolean();

        Thread thread = new Thread(() -> {
            try {
                gate.awaitOpen();
            } catch (InterruptedException e) {
                interrupted.set(true); // this is how reset gets through a paused gate
            }
        });
        thread.start();
        Thread.sleep(100);
        thread.interrupt();
        thread.join(2_000);

        assertTrue(interrupted.get());
    }
}
