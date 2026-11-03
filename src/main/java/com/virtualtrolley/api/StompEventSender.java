package com.virtualtrolley.api;

import com.virtualtrolley.events.EventSender;
import com.virtualtrolley.events.SequencedEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** Adapter: publishes each batch of events to every subscriber of /topic/events. */
@Component
class StompEventSender implements EventSender {

    private final SimpMessagingTemplate template;

    StompEventSender(SimpMessagingTemplate template) {
        this.template = template;
    }

    @Override
    public void send(List<SequencedEvent> batch) {
        template.convertAndSend("/topic/events", batch);
    }
}
