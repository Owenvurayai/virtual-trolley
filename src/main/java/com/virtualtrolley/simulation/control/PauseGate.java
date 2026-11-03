package com.virtualtrolley.simulation.control;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Cooperative pause switch. Worker threads call awaitOpen() between steps;
 * while the gate is paused they park there. An in-flight step (a sleep, a
 * payment) finishes first, so pause takes effect at the next step boundary.
 */
public class PauseGate {

    private final ReentrantLock lock = new ReentrantLock();
    private final Condition reopened = lock.newCondition();
    private boolean paused; // guarded by lock

    public void pause() {
        lock.lock();
        try {
            paused = true;
        } finally {
            lock.unlock();
        }
    }

    public void resume() {
        lock.lock();
        try {
            paused = false;
            reopened.signalAll();
        } finally {
            lock.unlock();
        }
    }

    /** Returns immediately when open; parks while paused. Interruptible, so reset can always get through. */
    public void awaitOpen() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (paused) { // loop guards against spurious wake-ups
                reopened.await();
            }
        } finally {
            lock.unlock();
        }
    }

    public boolean isPaused() {
        lock.lock();
        try {
            return paused;
        } finally {
            lock.unlock();
        }
    }
}
