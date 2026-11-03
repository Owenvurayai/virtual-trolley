package com.virtualtrolley.events;

import java.util.List;

/** Port: how a batch of events leaves the application (STOMP today, anything tomorrow). */
@FunctionalInterface
public interface EventSender {

    void send(List<SequencedEvent> batch);
}
