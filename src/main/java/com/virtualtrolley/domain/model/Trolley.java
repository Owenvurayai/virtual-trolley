package com.virtualtrolley.domain.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * The "smart" trolley: keeps a running total price and weight as items are
 * added or removed, and enforces its own lifecycle.
 *
 * Thread-safety: all state is guarded by a single lock. Only the current owner
 * may modify the contents, which is what "locking" a trolley means here.
 */
public final class Trolley {

    private final int id;
    private final String barcode;
    private final ReentrantLock lock = new ReentrantLock();

    // --- guarded by lock ---
    private final Map<Integer, CartLine> lines = new LinkedHashMap<>(); // keyed by product id
    private TrolleyState state = TrolleyState.AVAILABLE;
    private String owner;
    private long totalCents;
    private long totalGrams;

    public Trolley(int id, String barcode) {
        this.id = id;
        this.barcode = barcode;
    }

    // ---------- customer operations ----------

    /** Locks the trolley to a customer. AVAILABLE -> IN_USE. */
    public void assignTo(String ownerId) {
        lock.lock();
        try {
            transition(TrolleyState.IN_USE);
            owner = ownerId;
        } finally {
            lock.unlock();
        }
    }

    /** Adds one unit and updates totals. Owner only. */
    public void add(String callerId, Product product) {
        lock.lock();
        try {
            requireOwnerInState(callerId, TrolleyState.IN_USE);
            lines.merge(product.id(), new CartLine(product, 1),
                    (old, ignored) -> new CartLine(product, old.quantity() + 1));
            totalCents += product.priceCents();
            totalGrams += product.weightGrams();
        } finally {
            lock.unlock();
        }
    }

    /** Removes one unit and subtracts its price. Returns false if the product isn't in the trolley. */
    public boolean remove(String callerId, Product product) {
        lock.lock();
        try {
            requireOwnerInState(callerId, TrolleyState.IN_USE);
            CartLine line = lines.get(product.id());
            if (line == null) {
                return false;
            }
            if (line.quantity() == 1) {
                lines.remove(product.id());
            } else {
                lines.put(product.id(), new CartLine(product, line.quantity() - 1));
            }
            totalCents -= product.priceCents();
            totalGrams -= product.weightGrams();
            return true;
        } finally {
            lock.unlock();
        }
    }

    /** Customer joins the till queue. IN_USE -> AT_CHECKOUT. */
    public void proceedToCheckout(String callerId) {
        lock.lock();
        try {
            requireOwner(callerId);
            transition(TrolleyState.AT_CHECKOUT);
        } finally {
            lock.unlock();
        }
    }

    // ---------- cashier operations ----------

    /** Cashier scans the barcode. AT_CHECKOUT -> BEING_SCANNED, returns the cart for the screen. */
    public CartSnapshot beginScan() {
        lock.lock();
        try {
            transition(TrolleyState.BEING_SCANNED);
            return snapshot();
        } finally {
            lock.unlock();
        }
    }

    // ---------- shared ----------

    /** Wipes contents, clears the owner and makes the trolley AVAILABLE again. */
    public void reset() {
        lock.lock();
        try {
            transition(TrolleyState.RESETTING);
            lines.clear();
            totalCents = 0;
            totalGrams = 0;
            owner = null;
            transition(TrolleyState.AVAILABLE);
        } finally {
            lock.unlock();
        }
    }

    public CartSnapshot snapshot() {
        lock.lock();
        try {
            return new CartSnapshot(id, barcode, new ArrayList<>(lines.values()),
                    totalCents, totalGrams, Instant.now());
        } finally {
            lock.unlock();
        }
    }

    // ---------- accessors (locked for memory visibility) ----------

    public int id() {
        return id;
    }

    public String barcode() {
        return barcode;
    }

    public TrolleyState state() {
        lock.lock();
        try {
            return state;
        } finally {
            lock.unlock();
        }
    }

    public String owner() {
        lock.lock();
        try {
            return owner;
        } finally {
            lock.unlock();
        }
    }

    public long totalCents() {
        lock.lock();
        try {
            return totalCents;
        } finally {
            lock.unlock();
        }
    }

    public long totalGrams() {
        lock.lock();
        try {
            return totalGrams;
        } finally {
            lock.unlock();
        }
    }

    // ---------- invariants (call with lock held) ----------

    private void transition(TrolleyState next) {
        if (!state.canMoveTo(next)) {
            throw new IllegalStateException(
                    "Trolley %d: illegal transition %s -> %s".formatted(id, state, next));
        }
        state = next;
    }

    private void requireOwner(String callerId) {
        if (owner == null || !owner.equals(callerId)) {
            throw new IllegalStateException(
                    "Trolley %d is locked to %s, not %s".formatted(id, owner, callerId));
        }
    }

    private void requireOwnerInState(String callerId, TrolleyState expected) {
        requireOwner(callerId);
        if (state != expected) {
            throw new IllegalStateException(
                    "Trolley %d must be %s but is %s".formatted(id, expected, state));
        }
    }
}
