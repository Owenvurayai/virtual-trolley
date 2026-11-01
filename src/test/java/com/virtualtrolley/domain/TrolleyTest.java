package com.virtualtrolley.domain;

import com.virtualtrolley.domain.model.Product;
import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.domain.model.TrolleyState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TrolleyTest {

    private static final Product RICE = new Product(1, "Rice 10kg", 18_999, 10_000);
    private static final Product OIL = new Product(2, "Cooking Oil 5L", 8_499, 4_600);

    private Trolley trolley;

    @BeforeEach
    void setUp() {
        trolley = new Trolley(1, "TRL-0001");
        trolley.assignTo("thandi");
    }

    @Test
    void addUpdatesTotalPriceAndWeight() {
        trolley.add("thandi", RICE);
        trolley.add("thandi", OIL);

        assertEquals(27_498, trolley.totalCents());
        assertEquals(14_600, trolley.totalGrams());
    }

    @Test
    void removeSubtractsExactlyOneUnitPrice() {
        trolley.add("thandi", RICE);
        trolley.add("thandi", RICE);

        assertTrue(trolley.remove("thandi", RICE));

        assertEquals(18_999, trolley.totalCents());
        assertEquals(1, trolley.snapshot().itemCount());
    }

    @Test
    void removingAbsentProductChangesNothing() {
        trolley.add("thandi", RICE);

        assertFalse(trolley.remove("thandi", OIL));
        assertEquals(18_999, trolley.totalCents());
    }

    @Test
    void onlyTheOwnerMayModifyTheTrolley() {
        assertThrows(IllegalStateException.class, () -> trolley.add("sipho", RICE));
    }

    @Test
    void cannotAddAfterCheckoutStarts() {
        trolley.proceedToCheckout("thandi");

        assertThrows(IllegalStateException.class, () -> trolley.add("thandi", RICE));
    }

    @Test
    void illegalTransitionsAreRejected() {
        // Scanning a trolley that is still being shopped with
        assertThrows(IllegalStateException.class, trolley::beginScan);
        // Resetting a trolley that is already available
        trolley.reset();
        assertThrows(IllegalStateException.class, trolley::reset);
    }

    @Test
    void fullLifecycleEndsAvailableAndEmpty() {
        trolley.add("thandi", RICE);
        trolley.proceedToCheckout("thandi");
        var cart = trolley.beginScan();
        assertEquals(18_999, cart.totalCents());
        assertEquals(TrolleyState.BEING_SCANNED, trolley.state());

        trolley.reset();

        assertEquals(TrolleyState.AVAILABLE, trolley.state());
        assertEquals(0, trolley.totalCents());
        assertNull(trolley.owner());
    }

    @Test
    void snapshotIsUnaffectedByLaterChanges() {
        trolley.add("thandi", RICE);
        var snapshot = trolley.snapshot();

        trolley.add("thandi", OIL);

        assertEquals(18_999, snapshot.totalCents());
        assertEquals(1, snapshot.itemCount());
    }
}
