@api
Feature: Invoice API

  Scenario Outline: Get and send an invoice successfully
    Given the invoice API mock server is available
    When a token is requested with valid credentials
    And the invoice is viewed for barcode "<barcode>"
    And the invoice is sent for barcode "<barcode>"
    Then the viewInvoice response for barcode "<barcode>" should be saved to a file
    And the sendInvoice response for barcode "<barcode>" should be saved to a file

    Examples:
      | barcode |
      | 123456  |
      | 987654  |
      | 555111  |

  @negative
  Scenario: Reject sendInvoice with an invalid token
    Given the invoice API mock server is available
    When sendInvoice is called with an invalid token for barcode "123456"
    Then sendInvoice should return unauthorized
