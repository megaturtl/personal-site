{
  description = "Dev environment for the site, mirrors the node:lts-alpine build stage";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {inherit system;};
      nodejs = pkgs.nodejs_22;

      devServer = pkgs.writeShellApplication {
        name = "dev-server";
        runtimeInputs = [nodejs];
        text = ''
          npm install
          npm run dev
        '';
      };
    in {
      # `nix develop` drops you into a shell with node/npm on PATH
      devShells.default = pkgs.mkShell {
        packages = [nodejs];
      };

      # `nix run` installs deps and starts the dev server directly
      apps.default = flake-utils.lib.mkApp {
        drv = devServer;
      };
    });
}
