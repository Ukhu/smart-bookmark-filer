# bookmark-classification Specification

## Purpose

Classify an unfamiliar bookmark against user-approved folders through OpenAI while limiting disclosed data and treating model output as untrusted input.

## Requirements

### Requirement: Privacy-bounded classification input
The system SHALL send OpenAI only the bookmark title, bookmark URL, eligible folder IDs and contextual paths, and instructions needed to produce the structured classification.

#### Scenario: Classify an unfamiliar bookmark
- **WHEN** an eligible bookmark is submitted for classification
- **THEN** the request contains its title and URL plus only folders beneath the configured destination roots

#### Scenario: Exclude page and unrelated bookmark data
- **WHEN** the system constructs a classification request
- **THEN** the request excludes page content, browsing history, bookmarks outside the eligible roots, and unrelated stored settings

### Requirement: Constrained folder selection
The system SHALL request a structured result containing exactly one candidate folder ID and a confidence value from 0 through 1.

#### Scenario: OpenAI returns a conforming selection
- **WHEN** OpenAI selects an eligible folder and supplies a valid confidence value
- **THEN** the system exposes the selection for filing evaluation

#### Scenario: No destination candidates exist
- **WHEN** no eligible destination folders can be resolved
- **THEN** the system does not send a classification request and reports the classification as unresolved

### Requirement: Untrusted response validation
The system SHALL reject any classification result whose shape, folder ID, or confidence is not valid for the current request.

#### Scenario: Model invents a folder
- **WHEN** the response identifies a folder that was not included in the current candidate set
- **THEN** the system rejects the result as unresolved

#### Scenario: Model returns malformed data
- **WHEN** the response is missing required fields or contains an invalid confidence value
- **THEN** the system rejects the result as unresolved without attempting to interpret prose

#### Scenario: Candidate folder changed during classification
- **WHEN** the selected folder no longer exists or is no longer eligible when the response is evaluated
- **THEN** the system rejects the result as unresolved

### Requirement: Direct personal OpenAI authorization
The system SHALL authorize classification requests with the user's locally stored API key and use the configured OpenAI model.

#### Scenario: Configured credentials and model
- **WHEN** a classification request is made with valid saved settings
- **THEN** the request is sent directly to OpenAI using the saved key and selected model

#### Scenario: Missing credentials
- **WHEN** the API key or model is unavailable
- **THEN** the system does not contact OpenAI and reports the classification as unresolved

### Requirement: Classification failure isolation
The system SHALL convert provider, network, timeout, and response-validation failures into unresolved outcomes without exposing the API key in user-visible or diagnostic error text.

#### Scenario: OpenAI request fails
- **WHEN** OpenAI returns an error, the network request fails, or the request times out
- **THEN** the system reports an unresolved outcome and does not return a destination folder

#### Scenario: Failure details are shown
- **WHEN** a classification error is reported for diagnosis
- **THEN** the error identifies a safe failure category without including the API key or authorization header
