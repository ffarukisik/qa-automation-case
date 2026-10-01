@rules
Feature: Selection rules of the shopping scenario

  Scenario Outline: The lowest-rated seller is chosen among all sellers
    When the lowest-rated seller is chosen from "<sellers>"
    Then the result should be "<expected>"

    Examples:
      | sellers                                   | expected |
      | A:9,8;B:9,4;C:10,0                        | B        |
      | A:9,6;B:9,6;C:10,0                        | A        |
      | A:9,8                                     | A        |
      | A:n/a;B:9,9                               | B        |
      | A:n/a;B:n/a                               | A        |
      | A:9,8;B:9,4;C:9,7;D:9,1;E:9,9;F:9,3;G:9,5 | D        |

  Scenario Outline: A seller rating is read from its text
    When the rating is read from "<text>"
    Then the result should be "<expected>"

    Examples:
      | text | expected |
      | 9,8  | 9.8      |
      | 10,0 | 10       |
      | 9.6  | 9.6      |
      | 11   | none     |
      | abc  | none     |

  Scenario Outline: A price is read in the Turkish number format
    When the price is read from "<text>"
    Then the result should be "<expected>"

    Examples:
      | text             | expected |
      | 15.253,62 TL     | 15253.62 |
      | 18.700,00 TL     | 18700    |
      | 19.999 TL        | 19999    |
      | Fiyat yok        | none     |

  Scenario Outline: The bottom row is the last visual row of the first results page
    When the bottom row is taken from products at tops "<tops>"
    Then the result should be "<expected>"

    Examples:
      | tops                                 | expected |
      | 0,0,0,0,300,300,300,300,600,600      | 2        |
      | 0,0,0,0,300,300,300,300              | 4        |
      | 0,2,1,0,300,301,299,300,600,598,601  | 3        |
      | 0                                    | 1        |

  Scenario Outline: A cart line is matched with the product that was chosen
    When the cart title "<cart>" is compared with the product "<product>"
    Then the result should be "<expected>"

    Examples:
      | cart                                | product                                        | expected |
      | A5 5G Yeşil 8GB/256GB Modeli        | Oppo A5 5G Yeşil 8GB/256GB Modeli              | yes      |
      | OPPO A5 5G YEŞİL 8GB/256GB MODELİ   | Oppo A5 5G Yeşil 8GB/256GB Modeli              | yes      |
      | A5 5G Mavi 8GB/256GB Modeli         | Oppo A5 5G Yeşil 8GB/256GB Modeli              | no       |
      | A5 5G Yeşil 4GB/128GB Modeli        | Oppo A5 5G Yeşil 8GB/256GB Modeli              | no       |
      |                                     | Oppo A5 5G Yeşil 8GB/256GB Modeli              | no       |

  Scenario Outline: A cart line is matched with the chosen seller
    When the cart seller "<cart>" is compared with the seller "<seller>"
    Then the result should be "<expected>"

    Examples:
      | cart               | seller              | expected |
      | AZİM DİJİTAL       | AZİM DİJİTAL        | yes      |
      | azim dijital       | AZİM DİJİTAL        | yes      |
      | YAZICI TİCARET     | AZİM DİJİTAL        | no       |
      |                    | AZİM DİJİTAL        | no       |
