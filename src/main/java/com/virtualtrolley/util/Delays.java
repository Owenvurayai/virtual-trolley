package com.virtualtrolley.util;

import java.util.Random;

/** Simulated "real-world" waiting. A max of 0 disables the delay (used by tests). */
public final class Delays {

    private Delays() {
    }

    /** Sleeps for a random 1..maxMs milliseconds. */
    public static void sleepUpTo(Random random, long maxMs) throws InterruptedException {
        if (maxMs > 0) {
            Thread.sleep(1 + random.nextInt((int) maxMs));
        }
    }
}
