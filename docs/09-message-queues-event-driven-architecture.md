---
id: DOC-09
title: Message Queues & Event-Driven Architecture
category: System Architecture
---

# Message Queues & Event-Driven Architecture

## Overview
Asynchronous messaging decoupling (Kafka, RabbitMQ, AWS SQS) enables high throughput and system elasticity. Managing message order, duplicate deliveries, and dead letter queues requires strict architectural patterns.

## 1. Delivery Guarantees & Idempotence
- **At-Least-Once Delivery**: Message broker guarantees every message is delivered to consumers, but duplicates may occur due to network retries.
- **Idempotent Consumer Rule**: Every consumer MUST be idempotent. Processing the exact same message payload twice MUST result in identical state.
  - Implementation: Store unique message ID (`message_id` or correlation UUID) in DB table with unique constraint. If duplicate ID processed, skip business logic and return HTTP 200/ACK immediately.

## 2. Dead Letter Queue (DLQ) Management
- **Purpose**: Isolate corrupted, unparseable, or repeatedly failing messages without blocking processing of valid messages in primary queue.
- **DLQ Policy**:
  - Set maximum retry count (e.g. 3 attempts).
  - If consumer throws unhandled exception on 3rd attempt, move message to DLQ (`topic.dlq`).
  - Alert devops team via PagerDuty/Slack for DLQ non-zero count.
  - Provide DLQ replay utility script after fixing root bug.

## 3. Kafka vs RabbitMQ Architectural Selection
- **Apache Kafka**: Distributed commit log. High throughput stream processing. Event sourcing, log aggregation. Consumers track partition offset.
- **RabbitMQ**: Advanced AMQP message broker with complex routing exchange topologies (Direct, Topic, Fanout). Per-message acknowledgment. Best for task queues and discrete request-reply messaging.
