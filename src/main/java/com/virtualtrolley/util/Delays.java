package com.virtualtrolley.util;

import java.util.Random;

/** Simulated "real-world" waiting. A max of 0 disables the delay (used by tests). */
public final class Delays {

    private Delays() {
    }

    /**
     * Picks a duration between 25% and 100% of maxMs, so no step is implausibly instant.
     * Separate from sleep() so the caller can announce the duration (the UI animates to match it).
     */
    public static long pick(Random random, long maxMs) {
        if (maxMs <= 0) {
            return 0;
        }
        long min = maxMs / 4;
        long span = Math.max(1, maxMs - min);
        return Math.min(maxMs, min + 1 + random.nextInt((int) span)); // range: min+1 .. maxMs
    }

    public static void sleep(long ms) throws InterruptedException {
        if (ms > 0) {
            Thread.sleep(ms);
        }
    }

    public static void sleepUpTo(Random random, long maxMs) throws InterruptedException {
        sleep(pick(random, maxMs));
    }
}
