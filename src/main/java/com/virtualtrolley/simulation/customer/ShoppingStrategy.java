package com.virtualtrolley.simulation.customer;

import com.virtualtrolley.domain.model.Product;
import com.virtualtrolley.store.ProductCatalog;

import java.util.List;
import java.util.Random;

/** Strategy: different shopper personalities (stock-up, quick grab, ...). */
public interface ShoppingStrategy {

    /** The items this customer intends to pick, in walking order. Duplicates mean quantity > 1. */
    List<Product> chooseItems(ProductCatalog catalog, Random random);
}
