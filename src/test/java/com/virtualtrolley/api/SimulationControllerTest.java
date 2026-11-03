package com.virtualtrolley.api;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Full Spring context, simulated HTTP. Delays are kept on so the run is still going when we pause it. */
@SpringBootTest(properties = {
        "trolley.simulation.max-shop-delay-ms=300",
        "trolley.simulation.max-cashier-delay-ms=300"
})
@AutoConfigureMockMvc
class SimulationControllerTest {

    @Autowired
    private MockMvc mvc;

    @AfterEach
    void resetSimulation() throws Exception {
        mvc.perform(post("/api/simulation/reset")); // the context is shared, so leave it IDLE
    }

    @Test
    void productsAreListedWithStock() throws Exception {
        mvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(12)))
                .andExpect(jsonPath("$[0].name").value("Rice 10kg"))
                .andExpect(jsonPath("$[0].priceCents").value(18999));
    }

    @Test
    void idleStateShowsFullShelvesAndNoTrolleys() throws Exception {
        mvc.perform(get("/api/simulation/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IDLE"))
                .andExpect(jsonPath("$.trolleys", hasSize(0)))
                .andExpect(jsonPath("$.stock", hasSize(12)));
    }

    @Test
    void fullLifecycleStartPauseResumeReset() throws Exception {
        mvc.perform(post("/api/simulation/start"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));
        mvc.perform(get("/api/simulation/state"))
                .andExpect(jsonPath("$.trolleys", hasSize(5)));
        mvc.perform(post("/api/simulation/pause"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAUSED"));
        mvc.perform(post("/api/simulation/resume"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));
        mvc.perform(post("/api/simulation/reset"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IDLE"));
    }

    @Test
    void startingTwiceIsAConflict() throws Exception {
        mvc.perform(post("/api/simulation/start")).andExpect(status().isOk());
        mvc.perform(post("/api/simulation/start"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void pausingAnIdleSimulationIsAConflict() throws Exception {
        mvc.perform(post("/api/simulation/pause")).andExpect(status().isConflict());
    }

    @Test
    void resumingWithoutPauseIsAConflict() throws Exception {
        mvc.perform(post("/api/simulation/start")).andExpect(status().isOk());
        mvc.perform(post("/api/simulation/resume")).andExpect(status().isConflict());
    }
}
