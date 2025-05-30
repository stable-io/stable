tolib = $(addprefix lib/,$(firstword $(subst @, ,$(notdir $(1)))))

define install_lib
dependencies: $(call tolib,$(1))

$(call tolib,$(1)):
	forge install $(1) --no-git --no-commit
endef

.DEFAULT_GOAL = build
.PHONY: build test clean dependencies

build: dependencies
	forge build --skip test

test: dependencies
	forge test -vvv

LIB_DEPS = foundry-rs/forge-std
LIB_DEPS += wormhole-foundation/wormhole-solidity-sdk@54fa75d

# dynamically generate install rule for each lib dependency and add to dependencies
$(foreach dep,$(LIB_DEPS), $(eval $(call install_lib,$(dep))))

clean:
	forge clean
	rm -rf lib
