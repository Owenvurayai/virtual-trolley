package com.virtualtrolley.simulation.customer;

import com.virtualtrolley.domain.model.Product;
import com.virtualtrolley.store.ProductCatalog;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Picks a random number of random products. */
public final class RandomShopper implements ShoppingStrategy {

    private final int minItems;
    private final int maxItems;

    public RandomShopper(int minItems, int maxItems) {
        this.minItems = minItems;
        this.maxItems = maxItems;
    }

    @Override
    public List<Product> chooseItems(ProductCatalog catalog, Random random) {
        List<Product> products = catalog.products();
        int count = minItems + random.nextInt(maxItems - minItems + 1);
        List<Product> picks = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            picks.add(products.get(random.nextInt(products.size())));
        }
        return picks;
    }
}
