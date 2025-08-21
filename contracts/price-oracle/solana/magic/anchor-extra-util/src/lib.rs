extern crate proc_macro;
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, LitStr};

#[proc_macro]
pub fn declare_id_env(input: TokenStream) -> TokenStream {
    let env_var_name = parse_macro_input!(input as LitStr).value();

    let program_id = std::env::var(&env_var_name)
        .expect(&format!("Environment variable {env_var_name} not set"));

    let literal_program_id_string = LitStr::new(&program_id, proc_macro2::Span::call_site());

    let anchor_declare = quote! {
        anchor_lang::prelude::declare_id!(#literal_program_id_string);
    };

    anchor_declare.into()
}