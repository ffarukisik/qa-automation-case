@ui
Feature: Add a phone to the cart

  Scenario: Add a phone from the lowest-rated seller
    Given the user is logged in
    When the user searches for "cep telefonu"
    And the user filters the price between 15000 and 20000 TL
    And the user selects a random product from the bottom row
    And the user selects the lowest-rated seller
    Then the selected seller should have the lowest rating among all listed sellers
    When the user adds the selected seller product to the cart
    Then the selected product and seller should be displayed in the cart
