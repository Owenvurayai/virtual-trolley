package com.virtualtrolley.simulation.control;

import com.virtualtrolley.domain.model.CartSnapshot;
import com.virtualtrolley.domain.model.Trolley;
import com.virtualtrolley.domain.model.TrolleyState;
import com.virtualtrolley.events.SequencedEvent;

import java.util.List;

/**
 * Everything a freshly loaded browser needs to draw the shop right now.
 * The client applies this, then streamed events with seq > lastSeq.
 */
public record SimulationSnapshot(SimulationStatus status, long lastSeq, List<TrolleyView> trolleys,
                                 List<StockView> stock, StatsView stats, List<SequencedEvent> recentEvents) {

    public record TrolleyView(int id, String barcode, TrolleyState state, String owner,
                              int itemCount, long totalCents, long totalGrams) {

        static TrolleyView of(Trolley trolley) {
            CartSnapshot cart = trolley.snapshot();
            // state/owner are read separately from the cart: a view may be a few ms stale, which is fine for display
            return new TrolleyView(trolley.id(), trolley.barcode(), trolley.state(), trolley.owner(),
                    cart.itemCount(), cart.totalCents(), cart.totalGrams());
        }
    }

    public record StockView(int productId, int available) {
    }

    public record StatsView(long revenueCents, int salesCount, int queueLength) {
    }
}
