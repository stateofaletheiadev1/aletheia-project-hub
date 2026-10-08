# ISO 20022 status and return reasons

Generated from `crates/rails/src/reasons.rs` (spec Section 40C.10); a test keeps this file equal to the table. Do not edit by hand.

| ISO code | Meaning | APN state | Customer text (en) |
| --- | --- | --- | --- |
| `AB05` | Time-out at the creditor agent | INVESTIGATING | Your bank is confirming whether this payment arrived. Your money is held safely until it is confirmed. |
| `AB06` | Time-out at the instructed agent | INVESTIGATING | Your bank is confirming whether this payment arrived. Your money is held safely until it is confirmed. |
| `AC01` | Incorrect account number | REJECTED | The receiving account number is not valid. No money left your account. |
| `AC03` | Invalid creditor account number | REJECTED | The receiving account number is not valid. No money left your account. |
| `AC04` | Closed account | REJECTED / RETURNED | The receiving account is closed. |
| `AC06` | Blocked account | REJECTED / RETURNED | The receiving account is blocked. |
| `AG01` | Transaction forbidden on this account | REJECTED | The receiving account cannot accept this kind of payment. |
| `AM01` | Zero amount | REJECTED | The payment amount is zero. |
| `AM02` | Amount above the allowed maximum | REJECTED | The amount is above the maximum this payment type allows. |
| `AM03` | Currency not allowed | REJECTED | This payment type does not carry that currency. |
| `AM04` | Insufficient funds | REJECTED | There was not enough money for this payment. |
| `AM05` | Duplication | REJECTED | This payment was already sent. |
| `BE01` | Inconsistent with the end customer | REJECTED | The receiver's name does not match the account. |
| `CUST` | Requested by the customer | REJECTED / RETURNED | The payment was cancelled at the customer's request. |
| `DT01` | Invalid date | REJECTED | The payment date is not valid for this payment type. |
| `DUPL` | Duplicate payment | REJECTED | This payment was already sent. |
| `FF01` | Invalid file format | REJECTED | The payment message was not in a form the receiving system accepts. No money left your account. |
| `FOCR` | Following a cancellation request | REJECTED / RETURNED | The payment was returned after a cancellation request. |
| `MS03` | Reason not specified | REJECTED / RETURNED | The receiving bank declined this payment without giving a reason. |
| `NARR` | Narrative reason | REJECTED / RETURNED | The receiving bank declined this payment; see the explanation provided. |
| `RC01` | Bank identifier incorrect | REJECTED | The receiving bank's identifier is not valid. No money left your account. |
| `RR04` | Regulatory reason | REJECTED | The receiving bank declined this payment for regulatory reasons. |
