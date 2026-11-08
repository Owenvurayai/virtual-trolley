package com.virtualtrolley.events;

import com.virtualtrolley.domain.model.CartLine;
import com.virtualtrolley.domain.model.CartSnapshot;

import java.util.List;
import java.util.Map;

/** Builds the structured payloads attached to events. Keeps the JSON shape in one place. */
public final class EventData {

    private EventData() {
    }

    public static List<Map<String, Object>> lines(CartSnapshot cart) {
        return cart.lines().stream().map(EventData::line).toList();
    }

    private static Map<String, Object> line(CartLine l) {
        return Map.of(
                "productId", l.product().id(),
                "name", l.product().name(),
                "quantity", l.quantity(),
                "lineCents", l.lineTotalCents());
    }

    /** Everything the cashier screen needs to draw a basket. */
    public static Map<String, Object> cart(CartSnapshot cart, String customerId) {
        return Map.of(
                "customerId", customerId,
                "trolleyId", cart.trolleyId(),
                "barcode", cart.barcode(),
                "items", lines(cart),
                "itemCount", cart.itemCount(),
                "totalCents", cart.totalCents(),
                "totalGrams", cart.totalGrams());
    }
}
