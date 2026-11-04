# DDR-0004: "Accepted" instead of "Included" on the finality rule

S-5 asks for Signed → Submitted → Included → Finalized. The node never reports inclusion separately from
finality (it serves only finalized transactions), so an "Included" station could only be faked by a timer.
The third station is "Accepted": the node's own `ACCEPTED` answer to submission. Ink moves only on real
events.
