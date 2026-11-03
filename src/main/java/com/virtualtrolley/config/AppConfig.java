package com.virtualtrolley.config;

import com.virtualtrolley.store.ProductCatalog;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

    /** Swap for a JSON-backed catalogue later without touching any caller. */
    @Bean
    ProductCatalog productCatalog() {
        return ProductCatalog.demo();
    }
}
