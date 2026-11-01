package com.virtualtrolley.util;

import java.util.Locale;

/** Display helpers. Formatting only; never used for calculations. */
public final class Formats {

    private Formats() {
    }

    /** 134260 -> "R1,342.60". */
    public static String money(long cents) {
        return String.format(Locale.ROOT, "R%,d.%02d", cents / 100, cents % 100);
    }

    /** 12500 -> "12.5 kg". */
    public static String kg(long grams) {
        return String.format(Locale.ROOT, "%.1f kg", grams / 1000.0);
    }
}
