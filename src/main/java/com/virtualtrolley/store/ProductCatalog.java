package com.virtualtrolley.store;

import com.virtualtrolley.domain.model.Product;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only list of what the shop sells. Week 3+ will load this from products.json. */
public final class ProductCatalog {

    private final List<StockEntry> entries;
    private final Map<Integer, Product> byId;

    public ProductCatalog(List<StockEntry> entries) {
        this.entries = List.copyOf(entries);
        this.byId = entries.stream()
                .map(StockEntry::product)
                .collect(Collectors.toUnmodifiableMap(Product::id, Function.identity()));
    }

    public List<Product> products() {
        return entries.stream().map(StockEntry::product).toList();
    }

    public List<StockEntry> entries() {
        return entries;
    }

    public Product find(int productId) {
        return byId.get(productId);
    }

    /** Fresh inventory at opening-stock levels. */
    public Inventory newInventory() {
        return new Inventory(entries);
    }

    /** Demo data. Chicken is deliberately scarce so customers compete for it. */
    public static ProductCatalog demo() {
        return new ProductCatalog(List.of(
                entry(1, "Rice 10kg", 18_999, 10_000, 6),
                entry(2, "Cooking Oil 5L", 8_499, 4_600, 6),
                entry(3, "Chicken Portions 2kg", 12_999, 2_000, 3),
                entry(4, "Maize Meal 10kg", 9_999, 10_000, 6),
                entry(5, "Orange Juice 2L", 3_499, 2_100, 8),
                entry(6, "Full Cream Milk 6x1L", 8_999, 6_200, 6),
                entry(7, "Eggs 30s", 6_999, 1_900, 5),
                entry(8, "Sugar 5kg", 7_499, 5_000, 6),
                entry(9, "Brown Bread", 1_799, 700, 10),
                entry(10, "Toilet Paper 18s", 11_999, 1_800, 5),
                entry(11, "Washing Powder 3kg", 10_999, 3_100, 4),
                entry(12, "Coffee 750g", 15_999, 800, 4)));
    }

    private static StockEntry entry(int id, String name, long cents, long grams, int stock) {
        return new StockEntry(new Product(id, name, cents, grams), stock);
    }
}
