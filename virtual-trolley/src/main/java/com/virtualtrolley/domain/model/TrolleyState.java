package com.virtualtrolley.domain.model;

/**
 * Trolley lifecycle. Single source of truth for which transitions are legal.
 *
 * <pre>
 * AVAILABLE -> IN_USE -> AT_CHECKOUT -> BEING_SCANNED -> RESETTING -> AVAILABLE
 *                 \____________\______________\_____^   (failure / abandon paths)
 * </pre>
 */
public enum TrolleyState {
    AVAILABLE,
    IN_USE,
    AT_CHECKOUT,
    BEING_SCANNED,
    RESETTING;

    public boolean canMoveTo(TrolleyState next) {
        return switch (this) {
            case AVAILABLE -> next == IN_USE;
            case IN_USE -> next == AT_CHECKOUT || next == RESETTING;        // RESETTING = customer abandons
            case AT_CHECKOUT -> next == BEING_SCANNED || next == RESETTING; // RESETTING = queue timeout
            case BEING_SCANNED -> next == RESETTING;                        // paid, or payment failed
            case RESETTING -> next == AVAILABLE;
        };
    }
}
