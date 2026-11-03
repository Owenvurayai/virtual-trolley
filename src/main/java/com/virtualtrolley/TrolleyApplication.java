package com.virtualtrolley;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Web entry point (REST + WebSocket). ConsoleSimulationApp remains the headless entry point. */
@SpringBootApplication
@EnableScheduling // drives EventStreamService.flush()
@ConfigurationPropertiesScan
public class TrolleyApplication {

    public static void main(String[] args) {
        SpringApplication.run(TrolleyApplication.class, args);
    }
}
