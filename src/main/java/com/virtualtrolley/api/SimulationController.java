package com.virtualtrolley.api;

import com.virtualtrolley.simulation.control.SimulationService;
import com.virtualtrolley.simulation.control.SimulationSnapshot;
import com.virtualtrolley.simulation.control.SimulationStatus;
import com.virtualtrolley.store.ProductCatalog;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Thin HTTP adapter: no logic here, every call delegates to the service. */
@RestController
@RequestMapping("/api")
public class SimulationController {

    public record StatusResponse(SimulationStatus status) {
    }

    public record ProductResponse(int id, String name, long priceCents, long weightGrams, int initialStock) {
    }

    private final SimulationService service;
    private final ProductCatalog catalog;

    public SimulationController(SimulationService service, ProductCatalog catalog) {
        this.service = service;
        this.catalog = catalog;
    }

    @PostMapping("/simulation/start")
    public StatusResponse start() {
        return new StatusResponse(service.start());
    }

    @PostMapping("/simulation/pause")
    public StatusResponse pause() {
        return new StatusResponse(service.pause());
    }

    @PostMapping("/simulation/resume")
    public StatusResponse resume() {
        return new StatusResponse(service.resume());
    }

    @PostMapping("/simulation/reset")
    public StatusResponse reset() {
        return new StatusResponse(service.reset());
    }

    /** Current state plus recent events: what a freshly loaded or refreshed browser calls first. */
    @GetMapping("/simulation/state")
    public SimulationSnapshot state() {
        return service.snapshot();
    }

    @GetMapping("/products")
    public List<ProductResponse> products() {
        return catalog.entries().stream()
                .map(e -> new ProductResponse(e.product().id(), e.product().name(),
                        e.product().priceCents(), e.product().weightGrams(), e.initialStock()))
                .toList();
    }
}
